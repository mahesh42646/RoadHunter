const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['upi', 'qr_code', 'bank_transfer', 'wallet', 'other'],
      required: true,
    },
    details: {
      upiId: String,
      qrCodeUrl: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      accountHolderName: String,
      walletNumber: String,
      otherDetails: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);

