const mongoose = require('mongoose');

const callSchema = new mongoose.Schema(
  {
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'connected', 'missed', 'rejected', 'ended'],
      default: 'initiated',
    },
    callType: {
      type: String,
      enum: ['voice', 'video'],
      default: 'video',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    answeredAt: Date,
    endedAt: Date,
    duration: {
      type: Number, // Duration in seconds
      default: 0,
    },
    callerInfo: {
      displayName: String,
      photoUrl: String,
    },
    receiverInfo: {
      displayName: String,
      photoUrl: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
callSchema.index({ callerId: 1, createdAt: -1 });
callSchema.index({ receiverId: 1, createdAt: -1 });
callSchema.index({ status: 1 });
callSchema.index({ startedAt: -1 });

module.exports = mongoose.model('Call', callSchema);
