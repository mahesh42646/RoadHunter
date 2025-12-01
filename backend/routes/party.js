const express = require('express');

const Party = require('../schemas/party');
const User = require('../schemas/users');

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

      res.json({ parties, total: parties.length });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', authenticate, async (req, res, next) => {
    try {
      const { name, description, avatarUrl, privacy = 'public' } = req.body;
      if (!name || !name.trim()) {
        res.status(400).json({ error: 'Party name is required' });
        return;
      }

      const party = await Party.create({
        name: name.trim(),
        description: description?.trim(),
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
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }
      if (!party.isActive) {
        res.status(400).json({ error: 'Party is not active' });
        return;
      }

      // Check if user is already an active participant
      const existingParticipant = party.participants.find(
        (p) => p.userId.toString() === req.user._id.toString()
      );
      
      if (existingParticipant) {
        if (existingParticipant.status === 'active') {
          // Already in party, just return current state without emitting events
          res.json({ message: 'Already in party', party: sanitizeParty(party) });
          return;
        } else if (existingParticipant.status === 'left') {
          // User left before, reactivate them
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

  router.post('/:id/leave', authenticate, async (req, res, next) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) {
        res.status(404).json({ error: 'Party not found' });
        return;
      }

      const isHost = party.hostId.toString() === req.user._id.toString();
      if (isHost && party.participants.length > 1) {
        res.status(400).json({
          error: 'Cannot leave as host. Transfer host or end party first.',
          requiresAction: true,
        });
        return;
      }

      const wasHost = isHost;
      party.removeParticipant(req.user._id);

      if (wasHost && party.participants.length > 0) {
        const newHost = party.participants[0];
        party.hostId = newHost.userId;
        party.hostUsername = newHost.username;
        party.hostAvatarUrl = newHost.avatarUrl;
        newHost.role = 'host';
        party.hostMicEnabled = false;
        party.hostCameraEnabled = false;
      } else if (wasHost && party.participants.length === 0) {
        party.isActive = false;
        party.endedAt = new Date();
      }

      await party.save();

      io.to(`party:${party._id}`).emit('party:participantLeft', {
        partyId: party._id,
        userId: req.user._id.toString(),
        wasHost,
      });

      if (wasHost && party.participants.length > 0) {
        io.to(`party:${party._id}`).emit('party:hostTransferred', {
          partyId: party._id,
          newHostId: party.hostId.toString(),
          newHostUsername: party.hostUsername,
        });
      }

      res.json({ message: 'Left party' });
    } catch (error) {
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

