const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const paymentAdminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
paymentAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    // Only hash if password is a string and not already hashed
    if (typeof this.password === 'string' && !this.password.startsWith('$2')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    next();
  } catch (error) {
    console.error('[PaymentAdmin Schema] Error hashing password:', error);
    next(error);
  }
});

// Method to compare password
paymentAdminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to remove password from JSON output
paymentAdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Export model, but check if it already exists to avoid overwriting
module.exports = mongoose.models.PaymentAdmin || mongoose.model('PaymentAdmin', paymentAdminSchema);

