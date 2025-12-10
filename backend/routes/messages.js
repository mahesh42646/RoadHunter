const express = require('express');
const mongoose = require('mongoose');

const User = require('../schemas/users');
const Message = require('../schemas/messages');

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

module.exports = function createMessagesRouter(io) {
  const router = express.Router();

  // Get conversation with a friend
  router.get('/:friendId', authenticate, async (req, res, next) => {
    try {
      const { friendId } = req.params;
      const { limit = 50, before } = req.query;

      if (!mongoose.Types.ObjectId.isValid(friendId)) {
        res.status(400).json({ error: 'Invalid friend ID' });
        return;
      }

      // Verify they are friends
      const user = await User.findById(req.user._id);
      if (!user.social?.friends?.some((id) => id.toString() === friendId)) {
        res.status(403).json({ error: 'You can only message friends' });
        return;
      }

      const query = {
        $or: [
          { senderId: req.user._id, receiverId: friendId },
          { senderId: friendId, receiverId: req.user._id },
        ],
      };

      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit, 10))
        .populate('senderId', 'account.displayName account.photoUrl')
        .populate('receiverId', 'account.displayName account.photoUrl')
        .lean();

      // Mark messages as read
      await Message.updateMany(
        {
          senderId: friendId,
          receiverId: req.user._id,
          read: false,
        },
        {
          read: true,
          readAt: new Date(),
        }
      );

      // Notify sender that messages were read
      io.emit('messages:read', {
        userId: friendId,
        readBy: req.user._id.toString(),
      });

      res.json({
        messages: messages.reverse(),
      });
    } catch (error) {
      next(error);
    }
  });

  // Send message to friend
  router.post('/:friendId', authenticate, async (req, res, next) => {
    try {
      const { friendId } = req.params;
      const { message } = req.body;

      if (!mongoose.Types.ObjectId.isValid(friendId)) {
        res.status(400).json({ error: 'Invalid friend ID' });
        return;
      }

      if (!message || !message.trim()) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      // Verify they are friends
      const user = await User.findById(req.user._id);
      if (!user.social?.friends?.some((id) => id.toString() === friendId)) {
        res.status(403).json({ error: 'You can only message friends' });
        return;
      }

      const newMessage = await Message.create({
        senderId: req.user._id,
        receiverId: friendId,
        message: message.trim(),
        read: false,
      });

      const populatedMessage = await Message.findById(newMessage._id)
        .populate('senderId', 'account.displayName account.photoUrl')
        .populate('receiverId', 'account.displayName account.photoUrl')
        .lean();

      // Emit to both users
      io.emit('messages:new', {
        message: populatedMessage,
      });

      res.status(201).json({ message: populatedMessage });
    } catch (error) {
      next(error);
    }
  });

  // Get all conversations (list of friends with last message)
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);
      if (!user.social?.friends || user.social.friends.length === 0) {
        res.json({ conversations: [] });
        return;
      }

      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [
              { senderId: req.user._id },
              { receiverId: req.user._id },
            ],
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$senderId', req.user._id] },
                '$receiverId',
                '$senderId',
              ],
            },
            lastMessage: { $first: '$$ROOT' },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$receiverId', req.user._id] },
                      { $eq: ['$read', false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'friend',
          },
        },
        {
          $unwind: '$friend',
        },
        {
          $project: {
            friendId: '$_id',
            friend: {
              _id: '$friend._id',
              account: '$friend.account',
              progress: '$friend.progress',
            },
            lastMessage: 1,
            unreadCount: 1,
          },
        },
        {
          $sort: { 'lastMessage.createdAt': -1 },
        },
      ]);

      res.json({ conversations });
    } catch (error) {
      next(error);
    }
  });

  // Mark messages as read
  router.put('/:friendId/read', authenticate, async (req, res, next) => {
    try {
      const { friendId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(friendId)) {
        res.status(400).json({ error: 'Invalid friend ID' });
        return;
      }

      await Message.updateMany(
        {
          senderId: friendId,
          receiverId: req.user._id,
          read: false,
        },
        {
          read: true,
          readAt: new Date(),
        }
      );

      io.emit('messages:read', {
        userId: friendId,
        readBy: req.user._id.toString(),
      });

      res.json({ message: 'Messages marked as read' });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

