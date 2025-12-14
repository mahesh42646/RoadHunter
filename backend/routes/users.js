const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const path = require('path');

const User = require('../schemas/users');
const uploadUser = require('../middleware/uploadUser');
const { optimizeImage, getOptimizedPath } = require('../utils/imageOptimizer');

const {
  JWT_SECRET = 'change-me',
  JWT_EXPIRE = '1h',
  FIREBASE_SERVICE_ACCOUNT,
  FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
} = process.env;

function loadServiceAccount() {
  if (!FIREBASE_SERVICE_ACCOUNT) {
    return null;
  }
  try {
    const decoded = Buffer.from(FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    return JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  }
}

function ensureFirebaseApp() {
  if (admin.apps.length) {
    return admin.app();
  }
  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    throw new Error('Firebase admin requires FIREBASE_SERVICE_ACCOUNT');
  }
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function verifyWithAdmin(idToken) {
  const app = ensureFirebaseApp();
  return app.auth().verifyIdToken(idToken);
}

async function verifyWithRest(idToken) {
  if (!FIREBASE_WEB_API_KEY) {
    throw new Error('FIREBASE_WEB_API_KEY env var is required to verify Firebase tokens');
  }
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!resp.ok) {
    const payload = await resp.json().catch(() => ({}));
    const message = payload.error?.message || 'Unable to verify Firebase token';
    const error = new Error(message);
    error.status = 401;
    throw error;
  }
  const data = await resp.json();
  const user = data.users?.[0];
  if (!user) {
    const error = new Error('Invalid Firebase token');
    error.status = 401;
    throw error;
  }
  const provider = user.providerUserInfo?.[0];
  return {
    uid: user.localId,
    email: user.email,
    email_verified: user.emailVerified,
    name: user.displayName,
    picture: user.photoUrl,
    firebase: {
      sign_in_provider: provider?.providerId,
    },
  };
}

async function verifyFirebaseIdToken(idToken) {
  if (FIREBASE_SERVICE_ACCOUNT) {
    return verifyWithAdmin(idToken);
  }
  return verifyWithRest(idToken);
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      firebaseUid: user.account.firebaseUid,
      level: user.progress.level,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE },
  );
}

function sanitizeUser(user) {
  const plain = user.toObject({ versionKey: false });
  if (plain.transactions) {
    plain.transactions = plain.transactions.slice(-20);
  }
  // Remove Google photo URLs - only keep /uploads/ photos or null
  if (plain.account?.photoUrl && typeof plain.account.photoUrl === 'string') {
    const photoUrl = plain.account.photoUrl;
    // If it's a Google URL or any external URL that's not api.darkunde.in, set to null
    if ((photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) && 
        !photoUrl.includes('api.darkunde.in') && !photoUrl.includes('darkunde.in')) {
      plain.account.photoUrl = null;
      return plain; // Return early since we've set it to null
    }
    // If it's not /uploads/, set to null (only allow uploaded photos)
    if (photoUrl && !photoUrl.startsWith('/uploads') && !photoUrl.startsWith('http') && !photoUrl.startsWith('data:')) {
      plain.account.photoUrl = null;
    }
  }
  return plain;
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization token missing' });
    return;
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = function createUserRouter(io) {
  const router = express.Router();

  router.post('/session', async (req, res, next) => {
    try {
      const { idToken, referralCode } = req.body;
      if (!idToken) {
        res.status(400).json({ error: 'idToken is required' });
        return;
      }

      const decoded = await verifyFirebaseIdToken(idToken);
      const firebaseUid = decoded.uid;
      const providerId = decoded.firebase?.sign_in_provider;

      let user = await User.findOne({ 'account.firebaseUid': firebaseUid });
      const now = new Date();

      if (!user) {
        // New user - check for referral code
        let referredBy = null;
        if (referralCode) {
          const referrer = await User.findOne({ referralCode: referralCode.trim() });
          if (referrer && referrer._id) {
            referredBy = referrer._id;
          }
        }

        user = await User.create({
          account: {
            firebaseUid,
            email: decoded.email,
            emailVerified: decoded.email_verified,
            displayName: decoded.name,
            photoUrl: null, // Never use Google photos - only uploaded photos or null for initials
            providers: providerId ? [{ providerId, providerUid: firebaseUid }] : [],
            profileCompleted: false,
            status: 'active',
          },
          auth: {
            lastLoginAt: now,
            lastIp: req.ip,
          },
          wallet: {
            walletId: User.generateWalletId(),
            balanceUsd: 0,
            partyCoins: 0,
          },
          referredBy: referredBy,
          referral: {
            pending: 0,
            completed: 0,
            referralWallet: {
              partyCoins: 0,
              totalEarned: 0,
              totalWithdrawn: 0,
            },
            referrals: [],
          },
        });

        // If user was referred, add to referrer's pending referrals
        if (referredBy) {
          const referrer = await User.findById(referredBy);
          if (referrer) {
            // Initialize referral object if it doesn't exist
            if (!referrer.referral) {
              referrer.referral = {
                pending: 0,
                completed: 0,
                referralWallet: {
                  partyCoins: 0,
                  totalEarned: 0,
                  totalWithdrawn: 0,
                },
                referrals: [],
              };
            }
            
            referrer.referral.pending = (referrer.referral.pending || 0) + 1;
            referrer.referral.referrals.push({
              userId: user._id,
              status: 'pending',
              bonusEarned: 0,
              firstDepositAmount: 0,
              referredAt: now,
            });
            await referrer.save();

            io.emit('referral:new', {
              referrerId: referrer._id.toString(),
              referredUserId: user._id.toString(),
            });
          }
        }

        io.emit('user:joined', { userId: user._id, email: user.account.email });
      } else {
        // Ensure existing users have wallets initialized
        if (!user.wallet || !user.wallet.walletId) {
          user.wallet = {
            walletId: User.generateWalletId(),
            balanceUsd: 0,
            partyCoins: 0,
          };
        }
        
        // Initialize referral object if it doesn't exist
        if (!user.referral) {
          user.referral = {
            pending: 0,
            completed: 0,
            referralWallet: {
              partyCoins: 0,
              totalEarned: 0,
              totalWithdrawn: 0,
            },
            referrals: [],
          };
        }
        
        await user.save();
        user.account.email = decoded.email || user.account.email;
        user.account.emailVerified = decoded.email_verified ?? user.account.emailVerified;
        user.account.displayName = decoded.name || user.account.displayName;
        
        // NEVER use Google photos - only preserve uploaded photos (/uploads/)
        // If user has uploaded a custom photo, keep it
        // If not, set to null so initials are shown
        const hasCustomPhoto = user.account.photoUrl && user.account.photoUrl.startsWith('/uploads');
        if (!hasCustomPhoto) {
          // Remove any Google photo URLs - set to null for initials
          user.account.photoUrl = null;
        }
        // If user has custom photo, keep it and never overwrite
        
        if (providerId && !user.account.providers.some((p) => p.providerId === providerId)) {
          user.account.providers.push({ providerId, providerUid: firebaseUid });
        }
        user.auth.lastLoginAt = now;
        user.auth.lastIp = req.ip;
        await user.save();
      }

      const token = createToken(user);
      res.json({ token, user: sanitizeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/profile', authenticate, uploadUser.single('photo'), async (req, res, next) => {
    try {
      const { fullName, gender, profilePrivacy } = req.body;
      if (!fullName || !fullName.trim()) {
        res.status(400).json({ error: 'Full name is required' });
        return;
      }
      if (!gender) {
        res.status(400).json({ error: 'Gender is required' });
        return;
      }
      if (!profilePrivacy || !['public', 'private'].includes(profilePrivacy)) {
        res.status(400).json({ error: 'Profile privacy must be public or private' });
        return;
      }

      // Update account info
      req.user.account.displayName = fullName.trim();
      req.user.account.gender = gender;
      req.user.account.profileCompleted = true;

      // Handle profile photo upload
      let photoUrl = req.user.account.photoUrl; // Default to existing/Google avatar

      if (req.file) {
        try {
          // Optimize the uploaded image
          const optimizedPath = getOptimizedPath(req.file.path);
          await optimizeImage(req.file.path, optimizedPath);
          
          // Get relative path for URL
          const relativePath = path.relative(path.join(__dirname, '../uploads'), optimizedPath);
          photoUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;
        } catch (imageError) {
          console.error('Error processing profile photo:', imageError);
          // If image processing fails, use original file
          if (req.file && req.file.path) {
            const relativePath = path.relative(path.join(__dirname, '../uploads'), req.file.path);
            photoUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;
          }
        }
      }
      // If no file uploaded, keep existing photoUrl (Google auth avatar or existing photo)
      req.user.account.photoUrl = photoUrl;

      // Initialize social if not exists
      if (!req.user.social) {
        req.user.social = {
          profilePrivacy: profilePrivacy,
          friends: [],
          friendRequests: { sent: [], received: [] },
          followRequests: { sent: [], received: [] },
          removedFriends: [],
          removedBy: [],
          followers: [],
          following: [],
        };
      } else {
        req.user.social.profilePrivacy = profilePrivacy;
        // Ensure followRequests exists
        if (!req.user.social.followRequests) {
          req.user.social.followRequests = { sent: [], received: [] };
        }
      }

      const referralCode = req.user.referralCode || (await User.generateReferralCode());
      req.user.referralCode = referralCode;

      // Create profile entry
      const profileEntry = {
        fullName,
        email: req.user.account.email,
        phone: req.user.account.phone || '',
        avatarUrl: photoUrl,
        referralCode,
        status: 'verified',
        completedAt: new Date(),
      };

      req.user.profiles.push(profileEntry);

      if (!req.user.wallet?.walletId) {
        req.user.wallet = {
          walletId: User.generateWalletId(),
          balanceUsd: 0,
          partyCoins: 0,
        };
      }

      await req.user.save();
      io.emit('user:profileCompleted', { userId: req.user._id, referralCode });

      res.status(201).json({ 
        user: sanitizeUser(req.user),
        profile: profileEntry, 
        wallet: req.user.wallet 
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        const fs = require('fs');
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }
      next(error);
    }
  });

  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      const userData = sanitizeUser(user);
      
      // Include referral data if requested
      if (req.query.include === 'referral' || req.query.include === 'all') {
        userData.referral = {
          pending: user.referral?.pending || 0,
          completed: user.referral?.completed || 0,
          referralWallet: {
            partyCoins: user.referral?.referralWallet?.partyCoins || 0,
            totalEarned: user.referral?.referralWallet?.totalEarned || 0,
            totalWithdrawn: user.referral?.referralWallet?.totalWithdrawn || 0,
          },
          referrals: (user.referral?.referrals || []).map(r => ({
            userId: r.userId,
            status: r.status,
            bonusEarned: r.bonusEarned || 0,
            firstDepositAmount: r.firstDepositAmount || 0,
            referredAt: r.referredAt,
            completedAt: r.completedAt,
          })),
        };
      }
      
      res.json({ user: userData });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user data' });
    }
  });

  // Get referral details
  router.get('/referrals', authenticate, async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);
      
      // Initialize referral if it doesn't exist
      if (!user.referral) {
        user.referral = {
          pending: 0,
          completed: 0,
          referralWallet: {
            partyCoins: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
          },
          referrals: [],
        };
        await user.save();
      }

      // Populate referral user details
      const referralsWithDetails = await Promise.all(
        (user.referral.referrals || []).map(async (ref) => {
          const referredUser = await User.findById(ref.userId).select('account.displayName account.email account.photoUrl progress.level');
          return {
            userId: ref.userId,
            user: referredUser ? {
              displayName: referredUser.account?.displayName,
              email: referredUser.account?.email,
              photoUrl: referredUser.account?.photoUrl,
              level: referredUser.progress?.level || 1,
            } : null,
            status: ref.status,
            bonusEarned: ref.bonusEarned || 0,
            firstDepositAmount: ref.firstDepositAmount || 0,
            referredAt: ref.referredAt,
            completedAt: ref.completedAt,
          };
        })
      );

      res.json({
        pending: user.referral.pending || 0,
        completed: user.referral.completed || 0,
        referralWallet: {
          partyCoins: user.referral.referralWallet?.partyCoins || 0,
          totalEarned: user.referral.referralWallet?.totalEarned || 0,
          totalWithdrawn: user.referral.referralWallet?.totalWithdrawn || 0,
        },
        referrals: referralsWithDetails,
        referralCode: user.referralCode,
      });
    } catch (error) {
      next(error);
    }
  });

  // Withdraw from referral wallet to main wallet
  router.post('/referrals/withdraw', authenticate, async (req, res, next) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        res.status(400).json({ error: 'Valid amount is required' });
        return;
      }

      const user = await User.findById(req.user._id);
      
      if (!user.referral || !user.referral.referralWallet) {
        res.status(400).json({ error: 'Referral wallet not found' });
        return;
      }

      const availableBalance = user.referral.referralWallet.partyCoins || 0;
      if (amount > availableBalance) {
        res.status(400).json({ error: 'Insufficient balance in referral wallet' });
        return;
      }

      // Ensure main wallet exists
      if (!user.wallet || !user.wallet.walletId) {
        user.wallet = {
          walletId: User.generateWalletId(),
          balanceUsd: 0,
          partyCoins: 0,
        };
      }

      // Transfer from referral wallet to main wallet
      user.referral.referralWallet.partyCoins = availableBalance - amount;
      user.referral.referralWallet.totalWithdrawn = (user.referral.referralWallet.totalWithdrawn || 0) + amount;
      
      user.wallet.partyCoins = (user.wallet.partyCoins || 0) + amount;
      user.wallet.balanceUsd = Number((user.wallet.partyCoins / User.partyCoinsFromUsd(1)).toFixed(2));
      user.wallet.lastTransactionAt = new Date();

      // Add transaction record
      const transaction = {
        type: 'reward',
        amountUsd: amount / User.partyCoinsFromUsd(1),
        partyCoins: amount,
        status: 'completed',
        metadata: { source: 'referral_withdrawal' },
        processedAt: new Date(),
      };
      user.transactions.push(transaction);

      await user.save();

      io.emit('wallet:updated', {
        userId: user._id.toString(),
        wallet: user.wallet,
      });

      res.json({
        message: 'Withdrawal successful',
        referralWallet: {
          partyCoins: user.referral.referralWallet.partyCoins,
          totalEarned: user.referral.referralWallet.totalEarned,
          totalWithdrawn: user.referral.referralWallet.totalWithdrawn,
        },
        mainWallet: {
          walletId: user.wallet.walletId,
          balanceUsd: user.wallet.balanceUsd,
          partyCoins: user.wallet.partyCoins,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/wallet', authenticate, (req, res) => {
    if (!req.user.wallet?.walletId) {
      res.status(404).json({ error: 'Wallet not found. Complete profile first.' });
      return;
    }
    res.json({
      wallet: req.user.wallet,
      transactions: req.user.transactions.slice(-25).reverse(),
    });
  });

  router.post('/wallet/transactions', authenticate, async (req, res, next) => {
    try {
      const { type, amountUsd = 0, partyCoins, providerReference, metadata } = req.body;
      const allowedTypes = ['deposit', 'withdrawal', 'purchase', 'reward'];
      if (!allowedTypes.includes(type)) {
        res.status(400).json({ error: 'Invalid transaction type' });
        return;
      }
      if (!req.user.wallet?.walletId) {
        res.status(409).json({ error: 'Wallet missing. Complete profile first.' });
        return;
      }

      const coins = partyCoins ?? User.partyCoinsFromUsd(amountUsd);
      if (!Number.isFinite(coins) || coins <= 0) {
        res.status(400).json({ error: 'A positive amount is required' });
        return;
      }

      // Check if this is the first deposit
      const user = await User.findById(req.user._id);
      const hasPreviousDeposits = user.transactions?.some(
        t => t.type === 'deposit' && t.status === 'completed'
      );
      const isFirstDeposit = !hasPreviousDeposits && type === 'deposit';

      const debitTypes = ['withdrawal', 'purchase'];
      const balanceDelta = debitTypes.includes(type) ? -coins : coins;
      const nextCoins = (req.user.wallet.partyCoins || 0) + balanceDelta;
      if (nextCoins < 0) {
        res.status(400).json({ error: 'Insufficient party coins' });
        return;
      }

      const transaction = {
        type,
        amountUsd,
        partyCoins: coins,
        status: 'completed',
        providerReference,
        metadata: { ...metadata, isFirstDeposit },
        processedAt: new Date(),
      };

      user.transactions.push(transaction);
      user.wallet.partyCoins = nextCoins;
      user.wallet.balanceUsd = Number((nextCoins / User.partyCoinsFromUsd(1)).toFixed(2));
      user.wallet.lastTransactionAt = new Date();

      // Handle referral bonus for first deposit
      if (isFirstDeposit && user.referredBy) {
        const referrer = await User.findById(user.referredBy);
        if (referrer) {
          // Initialize referral object if it doesn't exist
          if (!referrer.referral) {
            referrer.referral = {
              pending: 0,
              completed: 0,
              referralWallet: {
                partyCoins: 0,
                totalEarned: 0,
                totalWithdrawn: 0,
              },
              referrals: [],
            };
          }

          // Calculate 10% referral bonus
          const referralBonus = Math.round(coins * 0.1);
          
          // Update referrer's referral wallet
          referrer.referral.referralWallet.partyCoins = (referrer.referral.referralWallet.partyCoins || 0) + referralBonus;
          referrer.referral.referralWallet.totalEarned = (referrer.referral.referralWallet.totalEarned || 0) + referralBonus;
          
          // Update referral status from pending to completed
          const referralEntry = referrer.referral.referrals.find(
            r => r.userId.toString() === user._id.toString() && r.status === 'pending'
          );
          
          if (referralEntry) {
            referralEntry.status = 'completed';
            referralEntry.bonusEarned = referralBonus;
            referralEntry.firstDepositAmount = amountUsd || (coins / User.partyCoinsFromUsd(1));
            referralEntry.completedAt = new Date();
          }
          
          // Update counts
          referrer.referral.pending = Math.max(0, (referrer.referral.pending || 0) - 1);
          referrer.referral.completed = (referrer.referral.completed || 0) + 1;
          
          await referrer.save();

          io.emit('referral:completed', {
            referrerId: referrer._id.toString(),
            referredUserId: user._id.toString(),
            bonus: referralBonus,
          });
        }
      }

      await user.save();
      io.emit('user:walletUpdated', {
        userId: req.user._id,
        wallet: req.user.wallet,
      });

      res.status(201).json(transaction);
    } catch (error) {
      next(error);
    }
  });

  router.post('/levels/xp', authenticate, async (req, res, next) => {
    try {
      const { xp } = req.body;
      if (!Number.isFinite(xp) || xp <= 0) {
        res.status(400).json({ error: 'xp must be a positive number' });
        return;
      }

      let leveledUp = false;
      req.user.progress.xp += xp;

      while (
        req.user.progress.xp >= req.user.progress.nextLevelAt &&
        req.user.progress.level < 100
      ) {
        req.user.progress.xp -= req.user.progress.nextLevelAt;
        req.user.progress.level += 1;
        req.user.progress.nextLevelAt = Math.round(req.user.progress.nextLevelAt * 1.2);
        req.user.progress.lastLevelUpAt = new Date();
        leveledUp = true;
      }

      await req.user.save();

      if (leveledUp) {
        io.emit('user:levelUp', {
          userId: req.user._id,
          level: req.user.progress.level,
        });
      }

      res.json({
        level: req.user.progress.level,
        xp: req.user.progress.xp,
        nextLevelAt: req.user.progress.nextLevelAt,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/', authenticate, async (req, res, next) => {
    try {
      const users = await User.find().sort({ createdAt: -1 }).limit(100);
      res.json(users.map((user) => sanitizeUser(user)));
    } catch (error) {
      next(error);
    }
  });

  // Report user
  router.post('/report/:userId', authenticate, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      if (!reason || !reason.trim()) {
        res.status(400).json({ error: 'Reason is required' });
        return;
      }

      if (userId === req.user._id.toString()) {
        res.status(400).json({ error: 'Cannot report yourself' });
        return;
      }

      const reportedUser = await User.findById(userId);
      if (!reportedUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Check if user is a friend (required to report)
      const user = await User.findById(req.user._id);
      const isFriend = user.social?.friends?.some((id) => id.toString() === userId) ||
                      user.social?.following?.some((id) => id.toString() === userId);

      if (!isFriend) {
        res.status(403).json({ error: 'Can only report friends' });
        return;
      }

      // Store report (you can extend this to save to a reports collection)
      // For now, we'll just log it and return success
      console.log(`User ${req.user._id} reported user ${userId}. Reason: ${reason}`);

      // TODO: Save to reports collection if you have one
      // const Report = require('../schemas/reports');
      // await Report.create({
      //   reporterId: req.user._id,
      //   reportedUserId: userId,
      //   reason: reason.trim(),
      //   createdAt: new Date(),
      // });

      res.json({ message: 'User reported successfully. Thank you for keeping our community safe.' });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

