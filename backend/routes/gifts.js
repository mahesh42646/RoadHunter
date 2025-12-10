const express = require('express');
const mongoose = require('mongoose');

const User = require('../schemas/users');
const Party = require('../schemas/party');

const GIFT_TYPES = {
  'lucky-kiss': { name: 'Lucky Kiss', price: 177, emoji: '💋' },
  'hugging-heart': { name: 'Hugging Heart', price: 1088, emoji: '🤗❤️' },
  'holding-hands': { name: 'Holding Hands', price: 3888, emoji: '🤝' },
  'lucky-star': { name: 'Lucky Star', price: 7777, emoji: '⭐' },
  'lollipop': { name: 'Lollipop', price: 5999, emoji: '🍭' },
  'kiss': { name: 'Kiss', price: 19999, emoji: '💋' },
  'bouquet': { name: 'Bouquet', price: 59999, emoji: '🌹' },
  'love-car': { name: 'Love Car', price: 89999, emoji: '🚗💕' },
};

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

module.exports = function createGiftRouter(io) {
  const router = express.Router();

  router.get('/types', (req, res) => {
    res.json({ gifts: GIFT_TYPES });
  });

  router.post('/send', authenticate, async (req, res, next) => {
    try {
      const { partyId, giftType, quantity = 1, recipientType, recipientId, randomCount, friendId } = req.body;

      if (!giftType || !GIFT_TYPES[giftType]) {
        res.status(400).json({ error: 'Invalid gift type' });
        return;
      }

      // Friend-to-friend gift (no party required)
      if (friendId) {
        if (!mongoose.Types.ObjectId.isValid(friendId)) {
          res.status(400).json({ error: 'Invalid friend ID' });
          return;
        }

        const user = await User.findById(req.user._id);
        if (!user.social?.friends?.some((id) => id.toString() === friendId)) {
          res.status(403).json({ error: 'Can only send gifts to friends' });
          return;
        }

        const friend = await User.findById(friendId);
        if (!friend) {
          res.status(404).json({ error: 'Friend not found' });
          return;
        }

        const gift = GIFT_TYPES[giftType];
        const totalCost = gift.price * quantity;

        // Ensure wallet is initialized
        if (!user.wallet || !user.wallet.walletId) {
          user.wallet = {
            walletId: User.generateWalletId(),
            balanceUsd: 0,
            partyCoins: 0,
          };
        }
        
        if (typeof user.wallet.partyCoins !== 'number') {
          user.wallet.partyCoins = 0;
        }
        
        if (user.wallet.partyCoins < totalCost) {
          res.status(400).json({ error: 'Insufficient party coins' });
          return;
        }

        const coinsPerRecipient = gift.price * quantity;

        user.wallet.partyCoins -= totalCost;
        user.wallet.balanceUsd = Number((user.wallet.partyCoins / User.partyCoinsFromUsd(1)).toFixed(2));
        user.wallet.lastTransactionAt = new Date();

        const senderTransaction = {
          type: 'gift_sent',
          amountUsd: totalCost / User.partyCoinsFromUsd(1),
          partyCoins: -totalCost,
          status: 'completed',
          metadata: {
            giftType,
            quantity,
            recipientType: 'friend',
            friendId: friend._id.toString(),
          },
          processedAt: new Date(),
        };
        user.transactions.push(senderTransaction);
        await user.save();

        // Ensure friend wallet is initialized
        if (!friend.wallet || !friend.wallet.walletId) {
          friend.wallet = {
            walletId: User.generateWalletId(),
            balanceUsd: 0,
            partyCoins: 0,
          };
        }
        
        if (typeof friend.wallet.partyCoins !== 'number') {
          friend.wallet.partyCoins = 0;
        }

        friend.wallet.partyCoins = friend.wallet.partyCoins + coinsPerRecipient;
        friend.wallet.balanceUsd = Number(
          (friend.wallet.partyCoins / User.partyCoinsFromUsd(1)).toFixed(2)
        );
        friend.wallet.lastTransactionAt = new Date();

        const recipientTransaction = {
          type: 'gift_received',
          amountUsd: coinsPerRecipient / User.partyCoinsFromUsd(1),
          partyCoins: coinsPerRecipient,
          status: 'completed',
          metadata: {
            giftType,
            quantity,
            senderId: user._id.toString(),
            senderName: user.account?.displayName || user.account?.email,
            recipientType: 'friend',
          },
          processedAt: new Date(),
        };
        friend.transactions.push(recipientTransaction);
        await friend.save();

        io.emit('wallet:updated', {
          userId: friend._id.toString(),
          wallet: friend.wallet,
        });

        io.emit('friends:giftSent', {
          fromUserId: user._id.toString(),
          toUserId: friend._id.toString(),
          gift: {
            giftType,
            quantity,
            giftName: gift.name,
            giftEmoji: gift.emoji,
            totalCost,
          },
        });

        io.emit('wallet:updated', {
          userId: user._id.toString(),
          wallet: user.wallet,
        });

        res.json({
          message: 'Gift sent successfully',
          gift: {
            giftType,
            quantity,
            giftName: gift.name,
            giftEmoji: gift.emoji,
            totalCost,
          },
          wallet: {
            walletId: user.wallet.walletId,
            balanceUsd: user.wallet.balanceUsd,
            partyCoins: user.wallet.partyCoins,
          },
        });
        return;
      }

      // Party gift (existing logic)
      if (!partyId) {
        res.status(400).json({ error: 'Party ID or friend ID is required' });
        return;
      }

      const party = await Party.findById(partyId);
      if (!party || !party.isActive) {
        res.status(404).json({ error: 'Party not found or inactive' });
        return;
      }

      const gift = GIFT_TYPES[giftType];
      
      let recipients = [];
      if (recipientType === 'all') {
        recipients = party.participants.filter((p) => p.status === 'active');
      } else if (recipientType === 'host') {
        const host = party.participants.find((p) => p.role === 'host');
        if (host) recipients = [host];
      } else if (recipientType === 'random' && randomCount) {
        const activeParticipants = party.participants.filter((p) => p.status === 'active');
        const shuffled = activeParticipants.sort(() => 0.5 - Math.random());
        recipients = shuffled.slice(0, Math.min(randomCount, activeParticipants.length));
      } else if (recipientId) {
        const recipient = party.participants.find(
          (p) => p.userId?.toString() === recipientId && p.status === 'active'
        );
        if (recipient) recipients = [recipient];
      }

      if (recipients.length === 0) {
        res.status(400).json({ error: 'No valid recipients found' });
        return;
      }

      // Calculate total cost: quantity * price * number of recipients
      // If quantity is 10 and there are 50 recipients, cost = 10 * price * 50 (500 gifts total)
      const totalCost = gift.price * quantity * recipients.length;

      const user = await User.findById(req.user._id);
      
      // Ensure wallet is initialized
      if (!user.wallet || !user.wallet.walletId) {
        user.wallet = {
          walletId: User.generateWalletId(),
          balanceUsd: 0,
          partyCoins: 0,
        };
      }
      
      // Ensure partyCoins is a number (default to 0 if undefined/null)
      if (typeof user.wallet.partyCoins !== 'number') {
        user.wallet.partyCoins = 0;
      }
      
      if (user.wallet.partyCoins < totalCost) {
        res.status(400).json({ error: 'Insufficient party coins' });
        return;
      }

      // Each recipient gets quantity * price worth of coins
      const coinsPerRecipient = gift.price * quantity;

      user.wallet.partyCoins -= totalCost;
      user.wallet.balanceUsd = Number((user.wallet.partyCoins / User.partyCoinsFromUsd(1)).toFixed(2));
      user.wallet.lastTransactionAt = new Date();

      const senderTransaction = {
        type: 'gift_sent',
        amountUsd: totalCost / User.partyCoinsFromUsd(1),
        partyCoins: -totalCost,
        status: 'completed',
        metadata: {
          giftType,
          quantity,
          recipientType,
          recipientCount: recipients.length,
          partyId: party._id.toString(),
        },
        processedAt: new Date(),
      };
      user.transactions.push(senderTransaction);
      await user.save();

      const recipientIds = recipients
        .map((r) => r.userId?.toString())
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      
      const recipientUsers = await User.find({ _id: { $in: recipientIds } });

      for (let i = 0; i < recipientUsers.length; i++) {
        const recipientUser = recipientUsers[i];
        const coinsToAdd = coinsPerRecipient;

        // Ensure wallet is initialized
        if (!recipientUser.wallet || !recipientUser.wallet.walletId) {
          recipientUser.wallet = {
            walletId: User.generateWalletId(),
            balanceUsd: 0,
            partyCoins: 0,
          };
        }
        
        // Ensure partyCoins is a number (default to 0 if undefined/null)
        if (typeof recipientUser.wallet.partyCoins !== 'number') {
          recipientUser.wallet.partyCoins = 0;
        }

        recipientUser.wallet.partyCoins = recipientUser.wallet.partyCoins + coinsToAdd;
        recipientUser.wallet.balanceUsd = Number(
          (recipientUser.wallet.partyCoins / User.partyCoinsFromUsd(1)).toFixed(2)
        );
        recipientUser.wallet.lastTransactionAt = new Date();

        const recipientTransaction = {
          type: 'gift_received',
          amountUsd: coinsToAdd / User.partyCoinsFromUsd(1),
          partyCoins: coinsToAdd,
          status: 'completed',
          metadata: {
            giftType,
            quantity,
            senderId: user._id.toString(),
            senderName: user.account?.displayName || user.account?.email,
            partyId: party._id.toString(),
          },
          processedAt: new Date(),
        };
        recipientUser.transactions.push(recipientTransaction);
        await recipientUser.save();

        io.emit('wallet:updated', {
          userId: recipientUser._id.toString(),
          wallet: recipientUser.wallet,
        });
      }

      const giftMessage = {
        userId: user._id.toString(),
        username: user.account?.displayName || user.account?.email || 'Anonymous',
        avatarUrl: user.account?.photoUrl,
        message: `sent ${quantity}x ${gift.name} ${gift.emoji} to ${recipientType === 'all' ? 'everyone' : recipientType === 'host' ? 'host' : `${recipients.length} participants`}`,
        timestamp: new Date(),
        type: 'gift',
        giftType,
        quantity,
        recipientType,
        recipientCount: recipients.length,
        totalCost,
      };

      party.chatMessages.push(giftMessage);
      await party.save();

      io.to(`party:${party._id}`).emit('party:giftSent', {
        partyId: party._id.toString(),
        gift: {
          giftType,
          quantity,
          giftName: gift.name,
          giftEmoji: gift.emoji,
          sender: {
            userId: user._id.toString(),
            username: user.account?.displayName || user.account?.email,
            avatarUrl: user.account?.photoUrl,
          },
          recipients: recipients.map((r) => ({
            userId: r.userId?.toString(),
            username: r.username,
            avatarUrl: r.avatarUrl,
          })),
          recipientType,
          totalCost,
        },
        message: giftMessage,
      });

      io.to(`party:${party._id}`).emit('party:chatMessage', {
        partyId: party._id.toString(),
        message: { ...giftMessage, userId: giftMessage.userId.toString() },
      });

      io.emit('wallet:updated', {
        userId: user._id.toString(),
        wallet: user.wallet,
      });

      res.json({
        message: 'Gift sent successfully',
        gift: {
          giftType,
          quantity,
          giftName: gift.name,
          giftEmoji: gift.emoji,
          recipientCount: recipients.length,
          totalCost,
        },
        wallet: {
          walletId: user.wallet.walletId,
          balanceUsd: user.wallet.balanceUsd,
          partyCoins: user.wallet.partyCoins,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

