const mongoose = require('mongoose');

const depositChatSchema = new mongoose.Schema(
  {
    depositRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DepositRequest',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    senderType: {
      type: String,
      enum: ['user', 'payment_admin', 'system'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'pricing', 'payment_details', 'approval_request', 'system'],
      default: 'text',
    },
    isFiltered: {
      type: Boolean,
      default: false,
    },
    originalMessage: {
      type: String, // Store original if filtered
    },
  },
  {
    timestamps: true,
  }
);

// Index for chat messages
depositChatSchema.index({ depositRequestId: 1, createdAt: 1 });

module.exports = mongoose.model('DepositChat', depositChatSchema);

