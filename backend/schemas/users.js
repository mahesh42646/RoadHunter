const crypto = require('node:crypto');
const mongoose = require('mongoose');

const REFERRAL_CODE_LENGTH = 10;
const PARTY_COINS_PER_USD = 100;

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false },
);

const profileSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: addressSchema,
    referralCode: { type: String, required: true },
    avatarUrl: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    completedAt: Date,
  },
  { _id: true, timestamps: true },
);

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'purchase', 'reward', 'gift_sent', 'gift_received'],
      required: true,
    },
    amountUsd: { type: Number, required: true, min: 0 },
    partyCoins: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    providerReference: { type: String, trim: true },
    metadata: mongoose.Schema.Types.Mixed,
    processedAt: Date,
  },
  { _id: true, timestamps: true },
);

const userSchema = new mongoose.Schema(
  {
    account: {
      firebaseUid: { type: String, required: true, trim: true },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      emailVerified: { type: Boolean, default: false },
      displayName: { type: String, trim: true },
      username: { type: String, trim: true },
      photoUrl: { type: String, trim: true },
      profileCompleted: { type: Boolean, default: false },
      gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not-to-say'], trim: true },
      status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'active' },
      providers: {
        type: [
          {
            providerId: { type: String, trim: true },
            providerUid: { type: String, trim: true },
            _id: false,
          },
        ],
        default: [],
      },
    },
    auth: {
      lastLoginAt: Date,
      lastIp: { type: String, trim: true },
    },
    profiles: {
      type: [profileSchema],
      default: [],
    },
    referralCode: { type: String, unique: true, sparse: true },
    wallet: {
      walletId: { type: String, trim: true },
      balanceUsd: { type: Number, default: 0 },
      partyCoins: { type: Number, default: 0 },
      lastTransactionAt: Date,
    },
    transactions: {
      type: [transactionSchema],
      default: [],
    },
    progress: {
      level: { type: Number, default: 1, min: 1, max: 100 },
      xp: { type: Number, default: 0, min: 0 },
      nextLevelAt: { type: Number, default: 100, min: 1 },
      lastLevelUpAt: Date,
    },
    settings: {
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
      },
      security: {
        mfaEnabled: { type: Boolean, default: false },
      },
    },
    social: {
      profilePrivacy: { type: String, enum: ['public', 'private'], default: 'public' },
      friends: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
      friendRequests: {
        sent: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
        received: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
      },
      removedFriends: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
      removedBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
      followers: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
      following: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    },
    audit: {
      createdBy: { type: String, trim: true },
      updatedBy: { type: String, trim: true },
    },
    isAdmin: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({ 'account.firebaseUid': 1 }, { unique: true });
userSchema.index({ 'wallet.walletId': 1 }, { unique: true, sparse: true });

function generateNumericCode(length) {
  let code = '';
  while (code.length < length) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code.slice(0, length);
}

userSchema.statics.generateReferralCode = async function generateReferralCode() {
  let code;
  let exists = true;
  while (exists) {
    code = generateNumericCode(REFERRAL_CODE_LENGTH);
    // eslint-disable-next-line no-await-in-loop
    exists = await this.exists({ referralCode: code });
  }
  return code;
};

userSchema.statics.generateWalletId = function generateWalletId() {
  return `WALLET-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

userSchema.statics.partyCoinsFromUsd = function partyCoinsFromUsd(amountUsd = 0) {
  return Math.round((amountUsd || 0) * PARTY_COINS_PER_USD);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);

