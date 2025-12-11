const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    avatarUrl: { type: String },
    role: { type: String, enum: ['host', 'participant'], default: 'participant' },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'muted', 'left', 'offline'], default: 'active' },
  },
  { _id: true, timestamps: false },
);

const joinRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    avatarUrl: { type: String },
    requestedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { _id: true, timestamps: false },
);

const chatMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    avatarUrl: { type: String },
    message: { type: String, required: true, maxlength: 500 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true, timestamps: false },
);

const partySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    avatarUrl: { type: String, trim: true },
    privacy: { type: String, enum: ['public', 'private'], default: 'public' },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hostUsername: { type: String, required: true },
    hostAvatarUrl: { type: String },
    participants: {
      type: [participantSchema],
      default: [],
      validate: {
        validator(v) {
          return v.length <= 50;
        },
        message: 'Room can have maximum 50 participants',
      },
    },
    joinRequests: {
      type: [joinRequestSchema],
      default: [],
    },
    chatMessages: {
      type: [chatMessageSchema],
      default: [],
    },
    isActive: { type: Boolean, default: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    hostMicEnabled: { type: Boolean, default: false },
    hostCameraEnabled: { type: Boolean, default: false },
    stats: {
      totalViews: { type: Number, default: 0 },
      peakParticipants: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

partySchema.index({ hostId: 1 });
partySchema.index({ privacy: 1, isActive: 1 });
partySchema.index({ 'participants.userId': 1 });
partySchema.index({ createdAt: -1 });

partySchema.methods.addParticipant = function addParticipant(userId, username, avatarUrl, role = 'participant') {
  if (this.participants.length >= 50) {
    throw new Error('Room is full (50 participants max)');
  }
  const exists = this.participants.some((p) => p.userId.toString() === userId.toString());
  if (exists) {
    return false; // Return false to indicate participant was not added
  }
  this.participants.push({ userId, username, avatarUrl, role, status: 'active', joinedAt: new Date() });
  if (this.participants.length > this.stats.peakParticipants) {
    this.stats.peakParticipants = this.participants.length;
  }
  return true; // Return true to indicate participant was added
};

partySchema.methods.removeParticipant = function removeParticipant(userId) {
  if (!userId) {
    throw new Error('UserId is required to remove participant');
  }
  this.participants = this.participants.filter(
    (p) => p.userId && p.userId.toString() !== userId.toString()
  );
};

partySchema.methods.addJoinRequest = function addJoinRequest(userId, username, avatarUrl) {
  if (this.privacy !== 'private') {
    return null;
  }
  const exists = this.joinRequests.some((r) => r.userId.toString() === userId.toString() && r.status === 'pending');
  if (exists) {
    return null;
  }
  const request = { userId, username, avatarUrl, requestedAt: new Date(), status: 'pending' };
  this.joinRequests.push(request);
  return request;
};

partySchema.methods.approveJoinRequest = function approveJoinRequest(userId) {
  const request = this.joinRequests.find(
    (r) => r.userId.toString() === userId.toString() && r.status === 'pending',
  );
  if (!request) {
    throw new Error('Join request not found');
  }
  request.status = 'approved';
  this.addParticipant(request.userId, request.username, request.avatarUrl);
  return request;
};

partySchema.methods.rejectJoinRequest = function rejectJoinRequest(userId) {
  const request = this.joinRequests.find(
    (r) => r.userId.toString() === userId.toString() && r.status === 'pending',
  );
  if (request) {
    request.status = 'rejected';
  }
};

partySchema.methods.addChatMessage = function addChatMessage(userId, username, avatarUrl, message) {
  if (this.chatMessages.length > 200) {
    this.chatMessages.shift();
  }
  this.chatMessages.push({ userId, username, avatarUrl, message, timestamp: new Date() });
};

partySchema.methods.incrementViews = function incrementViews() {
  this.stats.totalViews += 1;
};

module.exports = mongoose.models.Party || mongoose.model('Party', partySchema);

