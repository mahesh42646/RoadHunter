const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
    readAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Index for efficient querying
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, read: 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);

