const express = require('express');
const mongoose = require('mongoose');

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
  const plain = user.toObject ? user.toObject({ versionKey: false }) : user;
  
  // Remove Google photo URLs - only keep /uploads/ photos or null
  let photoUrl = plain.account?.photoUrl;
  if (photoUrl && typeof photoUrl === 'string') {
    // If it's a Google URL or any external URL that's not api.darkunde.in, set to null
    if ((photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) && 
        !photoUrl.includes('api.darkunde.in') && !photoUrl.includes('darkunde.in')) {
      photoUrl = null;
    } else if (photoUrl && !photoUrl.startsWith('/uploads') && !photoUrl.startsWith('http') && !photoUrl.startsWith('data:')) {
      // If it's not /uploads/, not http, and not data URL, set to null (only allow uploaded photos)
      photoUrl = null;
    }
  } else {
    photoUrl = null;
  }
  
  return {
    _id: plain._id,
    account: {
      firebaseUid: plain.account?.firebaseUid,
      email: plain.account?.email,
      displayName: plain.account?.displayName,
      username: plain.account?.username,
      photoUrl: photoUrl,
      profileCompleted: plain.account?.profileCompleted,
    },
    progress: plain.progress,
    social: plain.social,
  };
}

module.exports = function createFriendsRouter(io) {
  const router = express.Router();

  // Initialize social object if it doesn't exist
  async function ensureSocial(user) {
    if (!user.social) {
      user.social = {
        profilePrivacy: 'public',
        friends: [],
        friendRequests: { sent: [], received: [] },
        followRequests: { sent: [], received: [] },
        removedFriends: [],
        removedBy: [],
        followers: [],
        following: [],
        blockedUsers: [],
      };
    }
    // Ensure nested objects exist
    if (!user.social.friendRequests) {
      user.social.friendRequests = { sent: [], received: [] };
    }
    if (!user.social.followRequests) {
      user.social.followRequests = { sent: [], received: [] };
    }
    if (!user.social.friends) {
      user.social.friends = [];
    }
    if (!user.social.removedFriends) {
      user.social.removedFriends = [];
    }
    if (!user.social.removedBy) {
      user.social.removedBy = [];
    }
    if (!user.social.followers) {
      user.social.followers = [];
    }
    if (!user.social.following) {
      user.social.following = [];
    }
    if (!user.social.blockedUsers) {
      user.social.blockedUsers = [];
    }
    if (!user.social.profilePrivacy) {
      user.social.profilePrivacy = 'public';
    }
    await user.save();
    return user;
  }

  // Get user's following list (people they follow)
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const user = await ensureSocial(req.user);
      // Combine friends and following
      const followingIds = [
        ...user.social.friends.map((id) => id.toString()),
        ...user.social.following.map((id) => id.toString()),
      ];
      const uniqueFollowingIds = [...new Set(followingIds)];
      
      const following = await User.find({ _id: { $in: uniqueFollowingIds } })
        .select('account progress social.profilePrivacy')
        .lean();

      res.json({
        friends: following.map((f) => sanitizeUser(f)),
        followers: user.social.followers?.length || 0,
        following: uniqueFollowingIds.length,
      });
    } catch (error) {
      next(error);
    }
  });

  // Get friend requests (sent and received)
  router.get('/requests', authenticate, async (req, res, next) => {
    try {
      const user = await ensureSocial(req.user);
      const sent = await User.find({ _id: { $in: user.social.friendRequests.sent } })
        .select('account progress social.profilePrivacy')
        .lean();
      const received = await User.find({ _id: { $in: user.social.friendRequests.received } })
        .select('account progress social.profilePrivacy')
        .lean();

      res.json({
        sent: sent.map((u) => sanitizeUser(u)),
        received: received.map((u) => sanitizeUser(u)),
      });
    } catch (error) {
      next(error);
    }
  });

  // Send friend request
  router.post('/request/:userId', authenticate, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      if (userId === req.user._id.toString()) {
        res.status(400).json({ error: 'Cannot send friend request to yourself' });
        return;
      }

      const targetUser = await User.findById(userId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = await ensureSocial(req.user);
      const target = await ensureSocial(targetUser);

      // Check if user is blocked
      if (user.social.blockedUsers?.some((id) => id.toString() === userId)) {
        res.status(403).json({ error: 'Cannot interact with blocked user' });
        return;
      }

      // Check if you are blocked by this user
      if (target.social.blockedUsers?.some((id) => id.toString() === user._id.toString())) {
        res.status(403).json({ error: 'User has blocked you' });
        return;
      }

      // Check if already friends
      if (user.social.friends.some((id) => id.toString() === userId)) {
        res.status(400).json({ error: 'Already friends' });
        return;
      }

      // Check if request already sent
      if (user.social.friendRequests.sent.some((id) => id.toString() === userId)) {
        res.status(400).json({ error: 'Friend request already sent' });
        return;
      }

      // Check if request already received (mutual request)
      if (user.social.friendRequests.received.some((id) => id.toString() === userId)) {
        // Auto-accept if both sent requests
        user.social.friends.push(targetUser._id);
        target.social.friends.push(user._id);
        user.social.friendRequests.received = user.social.friendRequests.received.filter(
          (id) => id.toString() !== userId
        );
        target.social.friendRequests.sent = target.social.friendRequests.sent.filter(
          (id) => id.toString() !== user._id.toString()
        );

        await user.save();
        await target.save();

        io.emit('friends:requestAccepted', {
          userId: user._id.toString(),
          friendId: targetUser._id.toString(),
        });

        res.json({ message: 'Friend request accepted automatically', friend: sanitizeUser(target) });
        return;
      }

      // Check if already following
      if (user.social.following.some((id) => id.toString() === userId)) {
        res.status(400).json({ error: 'Already following this user' });
        return;
      }

      // Check if follow request already sent
      if (user.social.followRequests.sent.some((id) => id.toString() === userId)) {
        res.status(400).json({ error: 'Follow request already sent' });
        return;
      }

      // If profile is public, auto-follow instead of sending request
      if (target.social.profilePrivacy === 'public') {
        // User A follows User B (public profile)
        // Add User B to User A's following list
        const alreadyFollowing = user.social.following.some((id) => id.toString() === userId);
        if (!alreadyFollowing) {
          user.social.following.push(targetUser._id);
          user.markModified('social.following');
        }
        
        // Add User A to User B's followers list
        const alreadyFollower = target.social.followers.some((id) => id.toString() === user._id.toString());
        if (!alreadyFollower) {
          target.social.followers.push(user._id);
          target.markModified('social.followers');
        }
        
        // Save both users to ensure followers count is updated
        await Promise.all([user.save(), target.save()]);

        // Notify the followed user
        io.to(`user:${targetUser._id}`).emit('friends:followed', {
          userId: user._id.toString(),
          targetId: targetUser._id.toString(),
          follower: {
            _id: user._id.toString(),
            displayName: user.account?.displayName,
            photoUrl: user.account?.photoUrl,
          },
        });

        // Emit update events to refresh both users' data
        io.emit('user:socialUpdated', {
          userId: user._id.toString(),
          following: user.social.following.length,
        });
        io.emit('user:socialUpdated', {
          userId: targetUser._id.toString(),
          followers: target.social.followers.length,
        });

        res.json({ message: 'Now following', following: true, user: sanitizeUser(target) });
        return;
      }

      // Send follow request for private profiles
      // IMPORTANT: Do NOT add to following/followers until request is accepted
      if (!user.social.followRequests) {
        user.social.followRequests = { sent: [], received: [] };
      }
      if (!target.social.followRequests) {
        target.social.followRequests = { sent: [], received: [] };
      }

      // Only add to followRequests, NOT to following or followers
      if (!user.social.followRequests.sent.some((id) => id.toString() === userId)) {
        user.social.followRequests.sent.push(targetUser._id);
      }
      if (!target.social.followRequests.received.some((id) => id.toString() === user._id.toString())) {
        target.social.followRequests.received.push(user._id);
      }

      await user.save();
      await target.save();

      // Emit to specific user's room for notifications
      io.to(`user:${targetUser._id}`).emit('friends:followRequestReceived', {
        fromUserId: user._id.toString(),
        toUserId: targetUser._id.toString(),
        fromUser: {
          _id: user._id.toString(),
          displayName: user.account?.displayName,
          photoUrl: user.account?.photoUrl,
        },
      });

      res.json({ message: 'Follow request sent', user: sanitizeUser(target) });
    } catch (error) {
      next(error);
    }
  });

  // Accept friend request
  router.post('/accept/:userId', authenticate, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const user = await ensureSocial(req.user);
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const target = await ensureSocial(targetUser);

      // Check if friend request exists
      const hasFriendRequest = user.social.friendRequests.received.some((id) => id.toString() === userId);
      // Check if follow request exists
      const hasFollowRequest = user.social.followRequests?.received?.some((id) => id.toString() === userId);

      if (!hasFriendRequest && !hasFollowRequest) {
        res.status(400).json({ error: 'No request found' });
        return;
      }

      // Handle friend request
      if (hasFriendRequest) {
      // Add to friends
      if (!user.social.friends.some((id) => id.toString() === userId)) {
        user.social.friends.push(targetUser._id);
      }
      if (!target.social.friends.some((id) => id.toString() === user._id.toString())) {
        target.social.friends.push(user._id);
      }

      // Remove from requests
      user.social.friendRequests.received = user.social.friendRequests.received.filter(
        (id) => id.toString() !== userId
      );
      target.social.friendRequests.sent = target.social.friendRequests.sent.filter(
        (id) => id.toString() !== user._id.toString()
      );

      // Remove from removed lists if present
      user.social.removedFriends = user.social.removedFriends.filter(
        (id) => id.toString() !== userId
      );
      target.social.removedBy = target.social.removedBy.filter(
        (id) => id.toString() !== user._id.toString()
      );

      await user.save();
      await target.save();

      io.emit('friends:requestAccepted', {
        userId: user._id.toString(),
        friendId: targetUser._id.toString(),
      });

      res.json({ message: 'Friend request accepted', friend: sanitizeUser(target) });
        return;
      }

      // Handle follow request
      if (hasFollowRequest) {
        // When User B accepts User A's follow request:
        // - User A should be added to User A's following list (User A is now following User B)
        // - User A should be added to User B's followers list (User B has a new follower)
        // Note: user = User B (who is accepting), targetUser = User A (who sent the request)
        
        if (!target.social.following.some((id) => id.toString() === user._id.toString())) {
          target.social.following.push(user._id);
        }
        if (!user.social.followers.some((id) => id.toString() === targetUser._id.toString())) {
          user.social.followers.push(targetUser._id);
        }

        // Remove from follow requests
        user.social.followRequests.received = user.social.followRequests.received.filter(
          (id) => id.toString() !== userId
        );
        target.social.followRequests.sent = target.social.followRequests.sent.filter(
          (id) => id.toString() !== user._id.toString()
        );

        // Mark nested objects as modified to ensure they're saved
        target.markModified('social.following');
        user.markModified('social.followers');
        
        await user.save();
        await target.save();

        io.emit('friends:followRequestAccepted', {
          userId: user._id.toString(),
          followerId: targetUser._id.toString(),
        });

        // Emit update events to refresh both users' data
        io.emit('user:socialUpdated', {
          userId: targetUser._id.toString(),
          following: target.social.following.length,
        });
        io.emit('user:socialUpdated', {
          userId: user._id.toString(),
          followers: user.social.followers.length,
        });

        res.json({ message: 'Follow request accepted', user: sanitizeUser(target) });
      }
    } catch (error) {
      next(error);
    }
  });

  // Reject friend request or follow request
  router.post('/reject/:userId', authenticate, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const user = await ensureSocial(req.user);
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const target = await ensureSocial(targetUser);

      // Remove from friend requests
      user.social.friendRequests.received = user.social.friendRequests.received.filter(
        (id) => id.toString() !== userId
      );
      target.social.friendRequests.sent = target.social.friendRequests.sent.filter(
        (id) => id.toString() !== user._id.toString()
      );

      // Remove from follow requests
      if (user.social.followRequests) {
        user.social.followRequests.received = user.social.followRequests.received.filter(
          (id) => id.toString() !== userId
        );
      }
      if (target.social.followRequests) {
        target.social.followRequests.sent = target.social.followRequests.sent.filter(
          (id) => id.toString() !== user._id.toString()
        );
      }

      await user.save();
      await target.save();

      res.json({ message: 'Request rejected' });
    } catch (error) {
      next(error);
    }
  });

  // Remove friend or unfollow
  router.delete('/:userId', authenticate, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const user = await ensureSocial(req.user);
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const target = await ensureSocial(targetUser);

      let action = 'unfollowed';

      // Remove from friends if exists
      const wasFriend = user.social.friends.some((id) => id.toString() === userId);
      if (wasFriend) {
        user.social.friends = user.social.friends.filter((id) => id.toString() !== userId);
        target.social.friends = target.social.friends.filter(
          (id) => id.toString() !== user._id.toString()
        );
        user.social.removedFriends.push(targetUser._id);
        target.social.removedBy.push(user._id);
        action = 'removed';
      }

      // Remove from following/followers
      const wasFollowing = user.social.following.some((id) => id.toString() === userId);
      if (wasFollowing) {
        user.social.following = user.social.following.filter((id) => id.toString() !== userId);
        target.social.followers = target.social.followers.filter(
          (id) => id.toString() !== user._id.toString()
        );
      }

      // Remove from friend requests
      user.social.friendRequests.sent = user.social.friendRequests.sent.filter(
        (id) => id.toString() !== userId
      );
      user.social.friendRequests.received = user.social.friendRequests.received.filter(
        (id) => id.toString() !== userId
      );
      target.social.friendRequests.sent = target.social.friendRequests.sent.filter(
        (id) => id.toString() !== user._id.toString()
      );
      target.social.friendRequests.received = target.social.friendRequests.received.filter(
        (id) => id.toString() !== user._id.toString()
      );

      // Remove from follow requests
      if (user.social.followRequests) {
        user.social.followRequests.sent = user.social.followRequests.sent.filter(
          (id) => id.toString() !== userId
        );
        user.social.followRequests.received = user.social.followRequests.received.filter(
          (id) => id.toString() !== userId
        );
      }
      if (target.social.followRequests) {
        target.social.followRequests.sent = target.social.followRequests.sent.filter(
          (id) => id.toString() !== user._id.toString()
        );
        target.social.followRequests.received = target.social.followRequests.received.filter(
          (id) => id.toString() !== user._id.toString()
        );
      }

      await user.save();
      await target.save();

      io.emit('friends:removed', {
        userId: user._id.toString(),
        targetId: targetUser._id.toString(),
        action,
      });

      res.json({ message: `Successfully ${action}`, action });
    } catch (error) {
      next(error);
    }
  });

  // Get friend suggestions (users in same party rooms, not friends, not requested)
  router.get('/suggestions', authenticate, async (req, res, next) => {
    try {
      const user = await ensureSocial(req.user);
      const Party = require('../schemas/party');

      // Get all party participants user has been with
      const parties = await Party.find({
        'participants.userId': user._id,
        isActive: true,
      }).select('participants');

      const participantIds = new Set();
      parties.forEach((party) => {
        party.participants.forEach((p) => {
          if (p.userId && p.userId.toString() !== user._id.toString()) {
            participantIds.add(p.userId.toString());
          }
        });
      });

      // Exclude friends, sent requests, received requests, removed friends, following, and follow requests
      const excludeIds = [
        ...user.social.friends.map((id) => id.toString()),
        ...user.social.following.map((id) => id.toString()),
        ...user.social.friendRequests.sent.map((id) => id.toString()),
        ...user.social.friendRequests.received.map((id) => id.toString()),
        ...(user.social.followRequests?.sent || []).map((id) => id.toString()),
        ...(user.social.followRequests?.received || []).map((id) => id.toString()),
        ...user.social.removedFriends.map((id) => id.toString()),
      ];

      const suggestions = Array.from(participantIds)
        .filter((id) => !excludeIds.includes(id))
        .slice(0, 20);

      const users = await User.find({ _id: { $in: suggestions } })
        .select('account progress social.profilePrivacy')
        .limit(20)
        .lean();

      res.json({
        suggestions: users.map((u) => sanitizeUser(u)),
      });
    } catch (error) {
      next(error);
    }
  });

  // Update profile privacy
  router.put('/profile/privacy', authenticate, async (req, res, next) => {
    try {
      const { privacy } = req.body;
      if (!['public', 'private'].includes(privacy)) {
        res.status(400).json({ error: 'Privacy must be "public" or "private"' });
        return;
      }

      const user = await ensureSocial(req.user);
      user.social.profilePrivacy = privacy;
      await user.save();

      res.json({ message: 'Privacy updated', privacy: user.social.profilePrivacy });
    } catch (error) {
      next(error);
    }
  });

  // Get user profile (for viewing other users)
  router.get('/profile/:userId', authenticate, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const targetUser = await User.findById(userId).select('account progress social');
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = await ensureSocial(req.user);
      const target = await ensureSocial(targetUser);

      const isFriend = user.social.friends.some((id) => id.toString() === userId);
      const isFollowing = user.social.following.some((id) => id.toString() === userId);
      const hasSentFriendRequest = user.social.friendRequests.sent.some((id) => id.toString() === userId);
      const hasReceivedFriendRequest = user.social.friendRequests.received.some(
        (id) => id.toString() === userId
      );
      const hasSentFollowRequest = user.social.followRequests?.sent?.some((id) => id.toString() === userId);
      const hasReceivedFollowRequest = user.social.followRequests?.received?.some(
        (id) => id.toString() === userId
      );
      const followsYou = target.social.followers?.some((id) => id.toString() === user._id.toString());

      const profile = sanitizeUser(target);
      profile.relationship = {
        isFriend,
        isFollowing,
        hasSentFriendRequest,
        hasReceivedFriendRequest,
        hasSentFollowRequest,
        hasReceivedFollowRequest,
        followsYou,
        canView: target.social.profilePrivacy === 'public' || isFriend || isFollowing,
        profilePrivacy: target.social.profilePrivacy || 'public',
      };

      res.json({ user: profile });
    } catch (error) {
      next(error);
    }
  });

  // Get followers list with relationship status
  router.get('/followers', authenticate, async (req, res, next) => {
    try {
      const user = await ensureSocial(req.user);
      const followerIds = user.social.followers || [];
      const blockedIds = user.social.blockedUsers || [];
      
      // Filter out blocked users
      const unblockedFollowerIds = followerIds.filter(
        (id) => !blockedIds.some((blockedId) => blockedId.toString() === id.toString())
      );
      
      const followers = await User.find({ _id: { $in: unblockedFollowerIds } })
        .select('account progress social.profilePrivacy social.following social.followers social.followRequests')
        .lean();

      const currentUserId = user._id.toString();
      const followersWithStatus = followers.map((f) => {
        const follower = sanitizeUser(f);
        const isFollowing = user.social.following.some((id) => id.toString() === f._id.toString());
        const hasSentFollowRequest = user.social.followRequests?.sent?.some((id) => id.toString() === f._id.toString());
        const hasReceivedFollowRequest = user.social.followRequests?.received?.some((id) => id.toString() === f._id.toString());
        const canFollowBack = !isFollowing && !hasSentFollowRequest;
        
        follower.relationship = {
          isFollowing,
          hasSentFollowRequest,
          hasReceivedFollowRequest,
          canFollowBack,
          profilePrivacy: f.social?.profilePrivacy || 'public',
        };
        return follower;
      });

      res.json({
        followers: followersWithStatus,
      });
    } catch (error) {
      next(error);
    }
  });

  // Get following list with relationship status
  router.get('/following', authenticate, async (req, res, next) => {
    try {
      const user = await ensureSocial(req.user);
      const followingIds = [
        ...user.social.friends.map((id) => id.toString()),
        ...user.social.following.map((id) => id.toString()),
      ];
      const uniqueFollowingIds = [...new Set(followingIds)];
      
      const following = await User.find({ _id: { $in: uniqueFollowingIds } })
        .select('account progress social.profilePrivacy social.following social.followers')
        .lean();

      const followingWithStatus = following.map((f) => {
        const follow = sanitizeUser(f);
        const isFollowing = true; // They're in the following list
        const followsYou = f.social?.followers?.some((id) => id.toString() === user._id.toString());
        
        follow.relationship = {
          isFollowing,
          followsYou,
          profilePrivacy: f.social?.profilePrivacy || 'public',
        };
        return follow;
      });

      res.json({
        following: followingWithStatus,
      });
    } catch (error) {
      next(error);
    }
  });

  // Follow back endpoint
  router.post('/follow-back/:userId', authenticate, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      if (userId === req.user._id.toString()) {
        res.status(400).json({ error: 'Cannot follow yourself' });
        return;
      }

      const targetUser = await User.findById(userId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = await ensureSocial(req.user);
      const target = await ensureSocial(targetUser);

      // Check if user is following you (is in your followers list)
      const isFollower = user.social.followers.some((id) => id.toString() === userId);
      if (!isFollower) {
        res.status(400).json({ error: 'User is not following you' });
        return;
      }

      // Check if already following
      if (user.social.following.some((id) => id.toString() === userId)) {
        res.status(400).json({ error: 'Already following this user' });
        return;
      }

      // If target profile is public, auto-follow
      if (target.social.profilePrivacy === 'public') {
        // User B (PartynGame) follows back User A (Mahesh Darkunde) who is already following User B
        // Add User A (Mahesh Darkunde) to User B's (PartynGame's) following list
        const alreadyFollowing = user.social.following.some((id) => id.toString() === userId);
        if (!alreadyFollowing) {
          user.social.following.push(targetUser._id);
          user.markModified('social.following');
        }
        
        // Add User B (PartynGame) to User A's (Mahesh Darkunde's) followers list
        const alreadyFollower = target.social.followers.some((id) => id.toString() === user._id.toString());
        if (!alreadyFollower) {
          target.social.followers.push(user._id);
          target.markModified('social.followers');
        }
        
        // Ensure both users are saved
        await Promise.all([user.save(), target.save()]);

        // Emit update events to refresh both users' data
        io.emit('user:socialUpdated', {
          userId: user._id.toString(),
          following: user.social.following.length,
        });
        io.emit('user:socialUpdated', {
          userId: targetUser._id.toString(),
          followers: target.social.followers.length,
        });

        io.emit('friends:followed', {
          userId: user._id.toString(),
          targetId: targetUser._id.toString(),
        });

        res.json({ message: 'Now following', following: true, user: sanitizeUser(target) });
        return;
      }

      // If target profile is private, send follow request
      if (!user.social.followRequests) {
        user.social.followRequests = { sent: [], received: [] };
      }
      if (!target.social.followRequests) {
        target.social.followRequests = { sent: [], received: [] };
      }

      user.social.followRequests.sent.push(targetUser._id);
      target.social.followRequests.received.push(user._id);

      await user.save();
      await target.save();

      io.to(`user:${targetUser._id}`).emit('friends:followRequestReceived', {
        fromUserId: user._id.toString(),
        toUserId: targetUser._id.toString(),
        fromUser: {
          _id: user._id.toString(),
          displayName: user.account?.displayName,
          photoUrl: user.account?.photoUrl,
        },
      });

      res.json({ message: 'Follow request sent', user: sanitizeUser(target) });
    } catch (error) {
      next(error);
    }
  });

  // Block user
  router.post('/block/:userId', authenticate, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      if (userId === req.user._id.toString()) {
        res.status(400).json({ error: 'Cannot block yourself' });
        return;
      }

      const targetUser = await User.findById(userId);
      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = await ensureSocial(req.user);
      const target = await ensureSocial(targetUser);

      // Initialize blockedUsers if it doesn't exist
      if (!user.social.blockedUsers) {
        user.social.blockedUsers = [];
      }

      // Check if already blocked
      if (user.social.blockedUsers.some((id) => id.toString() === userId)) {
        res.status(400).json({ error: 'User is already blocked' });
        return;
      }

      // Add to blocked list
      user.social.blockedUsers.push(targetUser._id);

      // Remove from friends, following, followers, and requests
      user.social.friends = user.social.friends.filter((id) => id.toString() !== userId);
      user.social.following = user.social.following.filter((id) => id.toString() !== userId);
      user.social.followers = user.social.followers.filter((id) => id.toString() !== userId);
      target.social.followers = target.social.followers.filter((id) => id.toString() !== user._id.toString());
      target.social.following = target.social.following.filter((id) => id.toString() !== user._id.toString());
      target.social.friends = target.social.friends.filter((id) => id.toString() !== user._id.toString());

      // Remove from friend requests
      user.social.friendRequests.sent = user.social.friendRequests.sent.filter((id) => id.toString() !== userId);
      user.social.friendRequests.received = user.social.friendRequests.received.filter((id) => id.toString() !== userId);
      target.social.friendRequests.sent = target.social.friendRequests.sent.filter((id) => id.toString() !== user._id.toString());
      target.social.friendRequests.received = target.social.friendRequests.received.filter((id) => id.toString() !== user._id.toString());

      // Remove from follow requests
      if (user.social.followRequests) {
        user.social.followRequests.sent = user.social.followRequests.sent.filter((id) => id.toString() !== userId);
        user.social.followRequests.received = user.social.followRequests.received.filter((id) => id.toString() !== userId);
      }
      if (target.social.followRequests) {
        target.social.followRequests.sent = target.social.followRequests.sent.filter((id) => id.toString() !== user._id.toString());
        target.social.followRequests.received = target.social.followRequests.received.filter((id) => id.toString() !== user._id.toString());
      }

      user.markModified('social');
      target.markModified('social');

      await Promise.all([user.save(), target.save()]);

      io.emit('user:blocked', {
        blockerId: user._id.toString(),
        blockedId: targetUser._id.toString(),
      });

      res.json({ message: 'User blocked successfully' });
    } catch (error) {
      next(error);
    }
  });

  // Unblock user
  router.post('/unblock/:userId', authenticate, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const user = await ensureSocial(req.user);
      
      if (!user.social.blockedUsers) {
        res.status(400).json({ error: 'User is not blocked' });
        return;
      }

      const wasBlocked = user.social.blockedUsers.some((id) => id.toString() === userId);
      if (!wasBlocked) {
        res.status(400).json({ error: 'User is not blocked' });
        return;
      }

      // Remove from blocked list
      user.social.blockedUsers = user.social.blockedUsers.filter((id) => id.toString() !== userId);
      user.markModified('social.blockedUsers');

      await user.save();

      res.json({ message: 'User unblocked successfully' });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

