const express = require('express');
const mongoose = require('mongoose');
const Call = require('../schemas/calls');
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

function sanitizeUser(user) {
  if (!user) return null;
  const photoUrl = user.account?.photoUrl;
  const sanitizedPhotoUrl = photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('http') && !photoUrl.includes('api.darkunde.in') ? null : photoUrl;
  
  return {
    _id: user._id,
    account: {
      displayName: user.account?.displayName,
      email: user.account?.email,
      photoUrl: sanitizedPhotoUrl,
    },
  };
}

module.exports = function createCallsRouter(io) {
  const router = express.Router();

  // Get call history
  router.get('/history', authenticate, async (req, res, next) => {
    try {
      const { limit = 50, skip = 0 } = req.query;
      const userId = req.user._id.toString();

      const calls = await Call.find({
        $or: [
          { callerId: userId },
          { receiverId: userId },
        ],
      })
        .populate('callerId', 'account.displayName account.photoUrl')
        .populate('receiverId', 'account.displayName account.photoUrl')
        .sort({ startedAt: -1 })
        .limit(parseInt(limit, 10))
        .skip(parseInt(skip, 10))
        .lean();

      const sanitizedCalls = calls.map((call) => {
        const isCaller = call.callerId._id.toString() === userId;
        const otherUser = isCaller ? call.receiverId : call.callerId;
        
        return {
          _id: call._id,
          status: call.status,
          callType: call.callType,
          startedAt: call.startedAt,
          answeredAt: call.answeredAt,
          endedAt: call.endedAt,
          duration: call.duration,
          isCaller,
          otherUser: sanitizeUser(otherUser),
          direction: isCaller ? 'outgoing' : 'incoming',
        };
      });

      res.json({ calls: sanitizedCalls });
    } catch (error) {
      next(error);
    }
  });

  // Get ongoing calls
  router.get('/ongoing', authenticate, async (req, res, next) => {
    try {
      const userId = req.user._id.toString();

      const ongoingCalls = await Call.find({
        $or: [
          { callerId: userId },
          { receiverId: userId },
        ],
        status: { $in: ['initiated', 'ringing', 'connected'] },
      })
        .populate('callerId', 'account.displayName account.photoUrl')
        .populate('receiverId', 'account.displayName account.photoUrl')
        .sort({ startedAt: -1 })
        .lean();

      // Deduplicate calls - keep only the most recent call per user pair
      const callMap = new Map();
      ongoingCalls.forEach((call) => {
        const isCaller = call.callerId._id.toString() === userId;
        const otherUserId = isCaller 
          ? call.receiverId._id.toString() 
          : call.callerId._id.toString();
        
        const key = `${userId}-${otherUserId}`;
        const existing = callMap.get(key);
        
        // Keep the most recent call for this user pair
        if (!existing || new Date(call.startedAt) > new Date(existing.startedAt)) {
          callMap.set(key, call);
        }
      });

      const uniqueCalls = Array.from(callMap.values());

      const sanitizedCalls = uniqueCalls.map((call) => {
        const isCaller = call.callerId._id.toString() === userId;
        const otherUser = isCaller ? call.receiverId : call.callerId;
        
        return {
          _id: call._id,
          status: call.status,
          callType: call.callType,
          startedAt: call.startedAt,
          answeredAt: call.answeredAt,
          isCaller,
          otherUser: sanitizeUser(otherUser),
          direction: isCaller ? 'outgoing' : 'incoming',
        };
      });

      res.json({ calls: sanitizedCalls });
    } catch (error) {
      next(error);
    }
  });

  // Create call record
  router.post('/', authenticate, async (req, res, next) => {
    try {
      const { receiverId, callType = 'video' } = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        res.status(400).json({ error: 'Invalid receiver ID' });
        return;
      }

      const receiver = await User.findById(receiverId);
      if (!receiver) {
        res.status(404).json({ error: 'Receiver not found' });
        return;
      }

      const call = await Call.create({
        callerId: req.user._id,
        receiverId,
        callType,
        status: 'initiated',
        callerInfo: {
          displayName: req.user.account?.displayName,
          photoUrl: req.user.account?.photoUrl,
        },
        receiverInfo: {
          displayName: receiver.account?.displayName,
          photoUrl: receiver.account?.photoUrl,
        },
      });

      res.json({ call });
    } catch (error) {
      next(error);
    }
  });

  // Update call status
  router.patch('/:callId', authenticate, async (req, res, next) => {
    try {
      const { callId } = req.params;
      const { status, duration } = req.body;

      if (!mongoose.Types.ObjectId.isValid(callId)) {
        res.status(400).json({ error: 'Invalid call ID' });
        return;
      }

      const call = await Call.findById(callId);
      if (!call) {
        res.status(404).json({ error: 'Call not found' });
        return;
      }

      // Verify user is part of this call
      const userId = req.user._id.toString();
      if (call.callerId.toString() !== userId && call.receiverId.toString() !== userId) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }

      const updateData = {};
      if (status) {
        updateData.status = status;
        if (status === 'connected' && !call.answeredAt) {
          updateData.answeredAt = new Date();
        }
        if (status === 'ended' || status === 'missed' || status === 'rejected') {
          updateData.endedAt = new Date();
          if (call.answeredAt) {
            updateData.duration = Math.floor((new Date() - call.answeredAt) / 1000);
          }
        }
      }
      if (duration !== undefined) {
        updateData.duration = duration;
      }

      Object.assign(call, updateData);
      await call.save();

      res.json({ call });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
