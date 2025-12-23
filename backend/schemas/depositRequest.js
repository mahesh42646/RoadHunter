const mongoose = require('mongoose');

const depositRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paymentAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentAdmin',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'payment_details_sent', 'payment_pending', 'approved', 'rejected', 'closed'],
      default: 'pending',
    },
    requestedAmount: {
      type: Number,
      required: true,
    },
    coinsToAdd: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
    },
    paymentProof: {
      type: String, // URL to payment screenshot/proof
    },
    notes: {
      type: String,
    },
    closedBy: {
      type: String,
      enum: ['user', 'payment_admin'],
    },
    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding active requests
depositRequestSchema.index({ status: 1, paymentAdminId: 1 });
depositRequestSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('DepositRequest', depositRequestSchema);

