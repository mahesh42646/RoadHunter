const express = require('express');

const User = require('../schemas/users');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization token missing' });
    return;
  }

  const jwt = require('jsonwebtoken');
  const { JWT_SECRET = 'change-me' } = process.env;
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

module.exports = function createWalletRouter(io) {
  const router = express.Router();

  router.get('/balance', authenticate, async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user.wallet?.walletId) {
        user.wallet = {
          walletId: User.generateWalletId(),
          balanceUsd: 0,
          partyCoins: 0,
        };
        await user.save();
      }
      res.json({
        walletId: user.wallet.walletId,
        balanceUsd: user.wallet.balanceUsd || 0,
        partyCoins: user.wallet.partyCoins || 0,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get balance' });
    }
  });

  router.post('/deposit', authenticate, async (req, res, next) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        res.status(400).json({ error: 'Valid amount is required' });
        return;
      }

      const user = await User.findById(req.user._id);
      if (!user.wallet?.walletId) {
        user.wallet = {
          walletId: User.generateWalletId(),
          balanceUsd: 0,
          partyCoins: 0,
        };
      }

      // Check if this is the first deposit
      const hasPreviousDeposits = user.transactions?.some(
        t => t.type === 'deposit' && t.status === 'completed'
      );
      const isFirstDeposit = !hasPreviousDeposits;

      const partyCoins = User.partyCoinsFromUsd(amount);
      user.wallet.partyCoins = (user.wallet.partyCoins || 0) + partyCoins;
      user.wallet.balanceUsd = Number((user.wallet.partyCoins / User.partyCoinsFromUsd(1)).toFixed(2));
      user.wallet.lastTransactionAt = new Date();

      const transaction = {
        type: 'deposit',
        amountUsd: amount,
        partyCoins,
        status: 'completed',
        metadata: { source: 'manual_deposit', isFirstDeposit },
        processedAt: new Date(),
      };

      user.transactions.push(transaction);

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
          const referralBonus = Math.round(partyCoins * 0.1);
          
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
            referralEntry.firstDepositAmount = amount;
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

      io.emit('wallet:updated', {
        userId: user._id.toString(),
        wallet: user.wallet,
      });

      res.json({
        message: 'Deposit successful',
        wallet: {
          walletId: user.wallet.walletId,
          balanceUsd: user.wallet.balanceUsd,
          partyCoins: user.wallet.partyCoins,
        },
        transaction,
        isFirstDeposit,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/add-coins', authenticate, async (req, res, next) => {
    try {
      const { partyCoins } = req.body;
      if (!partyCoins || partyCoins <= 0) {
        res.status(400).json({ error: 'Valid party coins amount is required' });
        return;
      }

      const user = await User.findById(req.user._id);
      if (!user.wallet?.walletId) {
        user.wallet = {
          walletId: User.generateWalletId(),
          balanceUsd: 0,
          partyCoins: 0,
        };
      }

      // Check if this is the first deposit (checking for any completed deposit)
      const hasPreviousDeposits = user.transactions?.some(
        t => t.type === 'deposit' && t.status === 'completed'
      );
      const isFirstDeposit = !hasPreviousDeposits;

      user.wallet.partyCoins = (user.wallet.partyCoins || 0) + partyCoins;
      user.wallet.balanceUsd = Number((user.wallet.partyCoins / User.partyCoinsFromUsd(1)).toFixed(2));
      user.wallet.lastTransactionAt = new Date();

      const amountUsd = partyCoins / User.partyCoinsFromUsd(1);
      const transaction = {
        type: 'deposit',
        amountUsd,
        partyCoins,
        status: 'completed',
        metadata: { source: 'free_coins', isFirstDeposit },
        processedAt: new Date(),
      };

      user.transactions.push(transaction);

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
          const referralBonus = Math.round(partyCoins * 0.1);
          
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
            referralEntry.firstDepositAmount = amountUsd;
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

      io.emit('wallet:updated', {
        userId: user._id.toString(),
        wallet: user.wallet,
      });

      res.json({
        message: 'Coins added successfully',
        wallet: {
          walletId: user.wallet.walletId,
          balanceUsd: user.wallet.balanceUsd,
          partyCoins: user.wallet.partyCoins,
        },
        isFirstDeposit,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/transactions', authenticate, async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);
      const transactions = (user.transactions || []).slice(-50).reverse();
      res.json({ transactions });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

