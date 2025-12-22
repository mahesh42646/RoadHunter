const express = require('express');
const path = require('path');

const Party = require('../schemas/party');
const User = require('../schemas/users');
const upload = require('../middleware/upload');
const { optimizeImage, getOptimizedPath } = require('../utils/imageOptimizer');

function sanitizeParty(party) {
  const plain = party.toObject({ versionKey: false });
  if (plain.chatMessages && plain.chatMessages.length > 50) {
    plain.chatMessages = plain.chatMessages.slice(-50);
  }
  return plain;
}

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

module.exports = function createPartyRouter(io) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const { privacy = 'public', isActive = true, limit = 50, skip = 0 } = req.query;
      const query = { isActive: isActive === 'true' || isActive === true };
      if (privacy) {
        query.privacy = privacy;
      }

      const parties = await Party.find(query)
        .select('-chatMessages -joinRequests')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(Number(skip))
        .populate('hostId', 'account.displayName account.photoUrl')
        .lean();

      // Filter out parties with only offline participants
      const activeParties = parties.filter((party) => {
        const activeParticipants = party.participants.filter(
          (p) => p.userId && (p.status === 'active' || p.status === 'muted')
        );
        return activeParticipants.length > 0;
      });

      res.json({ parties: activeParties, total: activeParties.length });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', authenticate, upload.single('poster'), async (req, res, next) => {
    try {
      // Check if profile is complete
      if (!req.user.account?.profileCompleted) {
        res.status(403).json({ error: 'Please complete your profile before creating parties' });
        return;
      }

      const { name, description, privacy = 'public' } = req.body;
      if (!name || !name.trim()) {
        res.status(400).json({ error: 'Party name is required' });
        return;
      }

      let avatarUrl = null;

      // Handle file upload if present
      if (req.file) {
        try {
          const optimizedPath = getOptimizedPath(req.file.path);
          await optimizeImage(req.file.path, optimizedPath);
          
          // Get relative path for URL
          const relativePath = path.relative(path.join(__dirname, '../uploads'), optimizedPath);
          avatarUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;
        } catch (imageError) {
          console.error('Error processing image:', imageError);
          // If image processing fails, use original file
          const relativePath = path.relative(path.join(__dirname, '../uploads'), req.file.path);
          avatarUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;
        }
      }

      const party = await Party.create({
        name: name.trim(),
        description: description?.trim() || '',
        avatarUrl,
        privacy,
        hostId: req.user._id,
        hostUsername: req.user.account?.displayName || req.user.account?.email || 'Anonymous',
        hostAvatarUrl: req.user.account?.photoUrl,
      });

      party.addParticipant(req.user._id, party.hostUsername, party.hostAvatarUrl, 'host');
      await party.save();

      io.emit('party:created', { partyId: party._id, name: party.name });
      res.status(201).json({ party: sanitizeParty(party) });
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

  router.get('/:id', async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      res.json({ party: sanitizeParty(party) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/join', authenticate, async (req, res, next) => {
    try {
      // Check if profile is complete
      if (!req.user.account?.profileCompleted) {
        res.status(403).json({ error: 'Please complete your profile before joining parties' });
        return;
      }

      // Check if user is already in another ACTIVE party (not offline)
      const existingParty = await Party.findOne({
        'participants.userId': req.user._id,
        'participants.status': { $in: ['active', 'muted'] },
        isActive: true,
        _id: { $ne: req.params.id },
      });

      if (existingParty) {
        res.status(400).json({ 
          error: 'You are already in another party. Please leave that party first.',
          currentPartyId: existingParty._id.toString(),
        });
        return;
      }

      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      if (!party.isActive) {
        res.status(400).json({ error: 'Party is not active' });
        return;
      }

      // Check if user is already a participant
      const existingParticipant = party.participants.find(
        (p) => p.userId.toString() === req.user._id.toString()
      );
      
      if (existingParticipant) {
        if (existingParticipant.status === 'active' || existingParticipant.status === 'muted') {
          // Already in party, just return current state without emitting events
          res.json({ message: 'Already in party', party: sanitizeParty(party) });
          return;
        } else if (existingParticipant.status === 'left' || existingParticipant.status === 'offline') {
          // User left before or was offline (host), reactivate them
          existingParticipant.status = 'active';
          existingParticipant.joinedAt = new Date();
          party.incrementViews();
          await party.save();
          
          io.to(`party:${party._id}`).emit('party:participantJoined', {
            partyId: party._id,
            participant: {
              userId: req.user._id.toString(),
              username: req.user.account?.displayName || req.user.account?.email || 'Anonymous',
              avatarUrl: req.user.account?.photoUrl,
              role: existingParticipant.role || 'participant',
              status: 'active',
            },
          });
          
          res.json({ message: 'Rejoined party', party: sanitizeParty(party) });
          return;
        }
      }

      if (party.privacy === 'private') {
        const request = party.addJoinRequest(
          req.user._id,
          req.user.account?.displayName || req.user.account?.email || 'Anonymous',
          req.user.account?.photoUrl,
        );
        if (request) {
          await party.save();
          io.to(`party:${party._id}`).emit('party:joinRequest', {
            partyId: party._id,
            request: { ...request.toObject(), userId: request.userId.toString() },
          });
          res.json({ message: 'Join request sent', request });
          return;
        }
        res.status(400).json({ error: 'Join request already exists' });
        return;
      }

      try {
        const wasAdded = party.addParticipant(
          req.user._id,
          req.user.account?.displayName || req.user.account?.email || 'Anonymous',
          req.user.account?.photoUrl,
        );
        
        // Only emit event and increment views if participant was actually added
        if (wasAdded !== false) {
          party.incrementViews();
          await party.save();

          io.to(`party:${party._id}`).emit('party:participantJoined', {
            partyId: party._id,
            participant: {
              userId: req.user._id.toString(),
              username: req.user.account?.displayName || req.user.account?.email || 'Anonymous',
              avatarUrl: req.user.account?.photoUrl,
              role: 'participant',
              status: 'active',
            },
          });

          res.json({ message: 'Joined party', party: sanitizeParty(party) });
        } else {
          // Participant already existed, return current state
          res.json({ message: 'Already in party', party: sanitizeParty(party) });
        }
      } catch (err) {
        if (err.message.includes('full')) {
          res.status(400).json({ error: err.message });
          return;
        }
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/mark-offline', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }

      if (!req.user || !req.user._id) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const participant = party.participants.find(
        (p) => p.userId && p.userId.toString() === req.user._id.toString()
      );

      if (!participant) {
        res.status(404).json({ error: 'Participant not found' });
        return;
      }

      // Mark as offline
      participant.status = 'offline';
      await party.save();

      // Emit socket event
      if (io) {
        try {
          io.to(`party:${party._id}`).emit('party:participantOffline', {
            partyId: party._id.toString(),
            userId: req.user._id.toString(),
            isHost: false,
          });
        } catch (socketError) {
          console.error('Error emitting participantOffline event:', socketError);
        }
      }

      res.json({ message: 'Marked as offline', party: sanitizeParty(party) });
    } catch (error) {
      console.error('Error marking participant offline:', error);
      next(error);
    }
  });

  router.post('/:id/mark-active', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }

      if (!req.user || !req.user._id) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const participant = party.participants.find(
        (p) => p.userId && p.userId.toString() === req.user._id.toString()
      );

      if (!participant) {
        res.status(404).json({ error: 'Participant not found' });
        return;
      }

      // Mark as active
      participant.status = 'active';
      await party.save();

      // Emit socket event
      if (io) {
        try {
          io.to(`party:${party._id}`).emit('party:participantJoined', {
            partyId: party._id.toString(),
            participant: {
              userId: req.user._id.toString(),
              username: req.user.account?.displayName || req.user.account?.email || 'Anonymous',
              avatarUrl: req.user.account?.photoUrl,
              role: participant.role || 'participant',
              status: 'active',
            },
          });
        } catch (socketError) {
          console.error('Error emitting participantJoined event:', socketError);
        }
      }

      res.json({ message: 'Marked as active', party: sanitizeParty(party) });
    } catch (error) {
      console.error('Error marking participant active:', error);
      next(error);
    }
  });

  router.post('/:id/leave', authenticate, async (req, res, next) => {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: 'Party ID is required' });
        return;
      }

      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }

      if (!req.user || !req.user._id) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const isHost = party.hostId && party.hostId.toString() === req.user._id.toString();
      const participant = party.participants.find(
        (p) => p.userId && p.userId.toString() === req.user._id.toString()
      );

      // If user is not a participant, they're already not in the party
      if (!participant) {
        res.json({ message: 'Not in party' });
        return;
      }
      
      // If host tries to leave and there are other active participants, require transfer or end party
      if (isHost) {
        const activeParticipants = party.participants.filter(
          (p) => p.userId && (p.status === 'active' || p.status === 'muted') && p.userId.toString() !== req.user._id.toString()
        );
        
        if (activeParticipants.length > 0) {
          res.status(400).json({
            error: 'Cannot leave as host. Transfer host to someone else or end the party.',
            requiresAction: true,
          });
          return;
        }
      }

      const wasHost = isHost;
      
      // Remove participant
      const participantIndex = party.participants.findIndex(
        (p) => p.userId && p.userId.toString() === req.user._id.toString()
      );
      
      if (participantIndex !== -1) {
        party.participants.splice(participantIndex, 1);
      }

      // If host left, end the party (we already checked there are no other active participants)
      if (wasHost) {
        party.isActive = false;
        party.endedAt = new Date();
        // Keep hostId for validation (required field)
        if (!party.hostId) {
          party.hostId = req.user._id;
          party.hostUsername = req.user.account?.displayName || req.user.account?.email || 'Anonymous';
        }
      }

      // Ensure required fields are set before saving
      if (!party.hostId) {
        console.error('Party hostId is missing after leave operation');
        // Fallback: use the leaving user's ID (shouldn't happen, but safety check)
        party.hostId = req.user._id;
        party.hostUsername = req.user.account?.displayName || req.user.account?.email || 'Anonymous';
      }
      
      if (!party.hostUsername) {
        // Ensure hostUsername is always set
        if (party.participants.length > 0) {
          const firstParticipant = party.participants[0];
          party.hostUsername = firstParticipant.username || 'Anonymous';
        } else {
          party.hostUsername = req.user.account?.displayName || req.user.account?.email || 'Anonymous';
        }
      }

      // Ensure required fields are set
      if (!party.hostId) {
        party.hostId = req.user._id;
        party.hostUsername = req.user.account?.displayName || req.user.account?.email || 'Anonymous';
      }
      
      if (!party.hostUsername) {
        party.hostUsername = req.user.account?.displayName || req.user.account?.email || 'Anonymous';
      }

      // Save party
      await party.save();

      // Emit socket events
      if (io) {
        try {
          const partyIdStr = party._id.toString();
          const userIdStr = req.user._id.toString();
          
          io.to(`party:${partyIdStr}`).emit('party:participantLeft', {
            partyId: partyIdStr,
            userId: userIdStr,
            wasHost,
          });

          if (wasHost) {
            io.to(`party:${partyIdStr}`).emit('party:ended', {
              partyId: partyIdStr,
            });
          }
        } catch (socketError) {
          console.error('Error emitting socket events:', socketError);
        }
      }

      res.json({ message: 'Left party' });
    } catch (error) {
      console.error('Error in leave party endpoint:', error);
      next(error);
    }
  });

  router.post('/:id/request/:userId/approve', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      if (party.hostId.toString() !== req.user._id.toString()) {
        res.status(403).json({ error: 'Only host can approve requests' });
        return;
      }

      party.approveJoinRequest(req.params.userId);
      party.incrementViews();
      await party.save();

      io.to(`party:${party._id}`).emit('party:joinRequestApproved', {
        partyId: party._id,
        userId: req.params.userId,
      });

      res.json({ message: 'Join request approved', party: sanitizeParty(party) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/request/:userId/reject', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      if (party.hostId.toString() !== req.user._id.toString()) {
        res.status(403).json({ error: 'Only host can reject requests' });
        return;
      }

      party.rejectJoinRequest(req.params.userId);
      await party.save();

      res.json({ message: 'Join request rejected' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/chat', authenticate, async (req, res, next) => {
    try {
      const { message } = req.body;
      if (!message || !message.trim()) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }

      const participant = party.participants.find(
        (p) => p.userId.toString() === req.user._id.toString(),
      );
      if (!participant) {
        res.status(403).json({ error: 'You must be a participant to chat' });
        return;
      }
      if (participant.status === 'muted') {
        res.status(403).json({ error: 'You are muted and cannot send messages' });
        return;
      }

      party.addChatMessage(
        req.user._id,
        req.user.account?.displayName || req.user.account?.email || 'Anonymous',
        req.user.account?.photoUrl,
        message.trim(),
      );
      await party.save();

      const chatMessage = party.chatMessages[party.chatMessages.length - 1];
      io.to(`party:${party._id}`).emit('party:chatMessage', {
        partyId: party._id,
        message: {
          ...chatMessage.toObject(),
          userId: chatMessage.userId.toString(),
        },
      });

      res.json({ message: 'Chat message sent', chatMessage });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      if (party.hostId.toString() !== req.user._id.toString()) {
        res.status(403).json({ error: 'Only host can end party' });
        return;
      }

      party.isActive = false;
      party.endedAt = new Date();
      await party.save();

      io.to(`party:${party._id}`).emit('party:ended', { partyId: party._id });
      io.emit('party:ended', { partyId: party._id });

      res.json({ message: 'Party ended' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/transfer-host/:userId', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      if (party.hostId.toString() !== req.user._id.toString()) {
        res.status(403).json({ error: 'Only host can transfer host' });
        return;
      }

      const newHost = party.participants.find(
        (p) => p.userId.toString() === req.params.userId && p.status === 'active',
      );
      if (!newHost) {
        res.status(404).json({ error: 'Participant not found' });
        return;
      }

      const oldHost = party.participants.find((p) => p.role === 'host');
      if (oldHost) {
        oldHost.role = 'participant';
      }

      party.hostId = newHost.userId;
      party.hostUsername = newHost.username;
      party.hostAvatarUrl = newHost.avatarUrl;
      newHost.role = 'host';
      party.hostMicEnabled = false;
      party.hostCameraEnabled = false;

      await party.save();

      io.to(`party:${party._id}`).emit('party:hostTransferred', {
        partyId: party._id,
        newHostId: party.hostId.toString(),
        newHostUsername: party.hostUsername,
      });

      res.json({ message: 'Host transferred', party: sanitizeParty(party) });
    } catch (error) {
      next(error);
    }
  });

  // Distribute coins to all party participants (from game winnings)
  router.post('/:id/gifts/distribute-coins', authenticate, async (req, res, next) => {
    try {
      const { amount, gameId } = req.body;
      
      if (!amount || amount <= 0) {
        res.status(400).json({ error: 'Valid amount is required' });
        return;
      }

      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }

      // Check if user is a participant
      const isParticipant = party.participants.some(
        (p) => p.userId?.toString() === req.user._id.toString() && p.status === 'active'
      );
      if (!isParticipant) {
        res.status(403).json({ error: 'You must be a party participant to distribute coins' });
        return;
      }

      // Get all active participants (excluding the sender)
      const recipients = party.participants.filter(
        (p) => p.userId?.toString() !== req.user._id.toString() && p.status === 'active'
      );

      if (recipients.length === 0) {
        res.status(400).json({ error: 'No recipients found' });
        return;
      }

      // Calculate coins per recipient (distribute evenly)
      const coinsPerRecipient = Math.floor(amount / recipients.length);
      const totalDistributed = coinsPerRecipient * recipients.length;
      const remainder = amount - totalDistributed; // Keep remainder with sender

      const sender = await User.findById(req.user._id);
      if (!sender.wallet || !sender.wallet.walletId) {
        sender.wallet = {
          walletId: User.generateWalletId(),
          balanceUsd: 0,
          partyCoins: 0,
        };
      }

      if (typeof sender.wallet.partyCoins !== 'number') {
        sender.wallet.partyCoins = 0;
      }

      // Deduct the distributed amount from sender
      sender.wallet.partyCoins -= totalDistributed;
      sender.wallet.balanceUsd = Number((sender.wallet.partyCoins / User.partyCoinsFromUsd(1)).toFixed(2));
      sender.wallet.lastTransactionAt = new Date();

      // Add transaction for sender
      const senderTransaction = {
        type: 'gift_sent',
        amountUsd: totalDistributed / User.partyCoinsFromUsd(1),
        partyCoins: -totalDistributed,
        status: 'completed',
        metadata: {
          giftType: 'coin_distribution',
          recipientCount: recipients.length,
          partyId: party._id.toString(),
          gameId: gameId || null,
          coinsPerRecipient,
        },
        processedAt: new Date(),
      };
      sender.transactions.push(senderTransaction);
      await sender.save();

      // Get recipient user IDs
      const recipientIds = recipients
        .map((r) => r.userId?.toString())
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      const recipientUsers = await User.find({ _id: { $in: recipientIds } });

      // Distribute coins to each recipient
      for (const recipientUser of recipientUsers) {
        // Ensure wallet is initialized
        if (!recipientUser.wallet || !recipientUser.wallet.walletId) {
          recipientUser.wallet = {
            walletId: User.generateWalletId(),
            balanceUsd: 0,
            partyCoins: 0,
          };
        }

        if (typeof recipientUser.wallet.partyCoins !== 'number') {
          recipientUser.wallet.partyCoins = 0;
        }

        recipientUser.wallet.partyCoins += coinsPerRecipient;
        recipientUser.wallet.balanceUsd = Number((recipientUser.wallet.partyCoins / User.partyCoinsFromUsd(1)).toFixed(2));
        recipientUser.wallet.lastTransactionAt = new Date();

        // Add transaction for recipient
        const recipientTransaction = {
          type: 'gift_received',
          amountUsd: coinsPerRecipient / User.partyCoinsFromUsd(1),
          partyCoins: coinsPerRecipient,
          status: 'completed',
          metadata: {
            giftType: 'coin_distribution',
            senderId: req.user._id.toString(),
            senderUsername: req.user.account?.displayName || req.user.account?.email || 'Anonymous',
            partyId: party._id.toString(),
            gameId: gameId || null,
          },
          processedAt: new Date(),
        };
        recipientUser.transactions.push(recipientTransaction);
        await recipientUser.save();

        // Emit wallet update for recipient
        io.emit('wallet:updated', {
          userId: recipientUser._id.toString(),
          wallet: recipientUser.wallet,
        });
      }

      // Emit wallet update for sender
      io.emit('wallet:updated', {
        userId: req.user._id.toString(),
        wallet: sender.wallet,
      });

      // Emit party event for gift distribution
      io.to(`party:${party._id}`).emit('party:coinsDistributed', {
        partyId: party._id.toString(),
        senderId: req.user._id.toString(),
        senderUsername: req.user.account?.displayName || req.user.account?.email || 'Anonymous',
        totalAmount: totalDistributed,
        coinsPerRecipient,
        recipientCount: recipients.length,
        gameId: gameId || null,
      });

      res.json({
        message: 'Coins distributed successfully',
        distributed: totalDistributed,
        coinsPerRecipient,
        recipientCount: recipients.length,
        remainder,
        wallet: {
          walletId: sender.wallet.walletId,
          balanceUsd: sender.wallet.balanceUsd,
          partyCoins: sender.wallet.partyCoins,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/remove/:userId', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      if (party.hostId.toString() !== req.user._id.toString()) {
        res.status(403).json({ error: 'Only host can remove participants' });
        return;
      }

      const participant = party.participants.find(
        (p) => p.userId.toString() === req.params.userId,
      );
      if (!participant) {
        res.status(404).json({ error: 'Participant not found' });
        return;
      }
      if (participant.role === 'host') {
        res.status(400).json({ error: 'Cannot remove host' });
        return;
      }

      party.removeParticipant(req.params.userId);
      await party.save();

      io.to(`party:${party._id}`).emit('party:participantRemoved', {
        partyId: party._id,
        userId: req.params.userId,
      });

      res.json({ message: 'Participant removed', party: sanitizeParty(party) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/mute/:userId', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      if (party.hostId.toString() !== req.user._id.toString()) {
        res.status(403).json({ error: 'Only host can mute participants' });
        return;
      }

      const participant = party.participants.find(
        (p) => p.userId.toString() === req.params.userId,
      );
      if (!participant) {
        res.status(404).json({ error: 'Participant not found' });
        return;
      }

      participant.status = participant.status === 'muted' ? 'active' : 'muted';
      await party.save();

      io.to(`party:${party._id}`).emit('party:participantMuted', {
        partyId: party._id,
        userId: req.params.userId,
        muted: participant.status === 'muted',
      });

      res.json({
        message: participant.status === 'muted' ? 'Participant muted' : 'Participant unmuted',
        party: sanitizeParty(party),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/toggle-mic', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      if (party.hostId.toString() !== req.user._id.toString()) {
        res.status(403).json({ error: 'Only host can toggle mic' });
        return;
      }

      party.hostMicEnabled = !party.hostMicEnabled;
      await party.save();

      io.to(`party:${party._id}`).emit('party:hostMicToggled', {
        partyId: party._id,
        enabled: party.hostMicEnabled,
      });

      res.json({
        message: party.hostMicEnabled ? 'Mic enabled' : 'Mic disabled',
        party: sanitizeParty(party),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/toggle-camera', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      if (party.hostId.toString() !== req.user._id.toString()) {
        res.status(403).json({ error: 'Only host can toggle camera' });
        return;
      }

      party.hostCameraEnabled = !party.hostCameraEnabled;
      await party.save();

      io.to(`party:${party._id}`).emit('party:hostCameraToggled', {
        partyId: party._id,
        enabled: party.hostCameraEnabled,
      });

      res.json({
        message: party.hostCameraEnabled ? 'Camera enabled' : 'Camera disabled',
        party: sanitizeParty(party),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

