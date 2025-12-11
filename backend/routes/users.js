const express = require('express');
const jwt = require('jsonwebtoken');
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
      const { idToken } = req.body;
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
        user = await User.create({
          account: {
            firebaseUid,
            email: decoded.email,
            emailVerified: decoded.email_verified,
            displayName: decoded.name,
            photoUrl: decoded.picture,
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
        });
        io.emit('user:joined', { userId: user._id, email: user.account.email });
      } else {
        // Ensure existing users have wallets initialized
        if (!user.wallet || !user.wallet.walletId) {
          user.wallet = {
            walletId: User.generateWalletId(),
            balanceUsd: 0,
            partyCoins: 0,
          };
          await user.save();
        }
        user.account.email = decoded.email || user.account.email;
        user.account.emailVerified = decoded.email_verified ?? user.account.emailVerified;
        user.account.displayName = decoded.name || user.account.displayName;
        user.account.photoUrl = decoded.picture || user.account.photoUrl;
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
          removedFriends: [],
          removedBy: [],
          followers: [],
          following: [],
        };
      } else {
        req.user.social.profilePrivacy = profilePrivacy;
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

  router.get('/me', authenticate, (req, res) => {
    res.json({ user: sanitizeUser(req.user) });
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
        metadata,
        processedAt: new Date(),
      };

      req.user.transactions.push(transaction);
      req.user.wallet.partyCoins = nextCoins;
      req.user.wallet.balanceUsd = Number((nextCoins / User.partyCoinsFromUsd(1)).toFixed(2));
      req.user.wallet.lastTransactionAt = new Date();

      await req.user.save();
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

  return router;
};

