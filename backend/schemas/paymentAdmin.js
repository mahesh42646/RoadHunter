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
  // Skip if password hasn't been modified
  if (!this.isModified('password')) {
    return next();
  }
  
  // Skip if password is empty or undefined
  if (!this.password) {
    return next();
  }
  
  try {
    // Only hash if password is a string
    if (typeof this.password !== 'string') {
      return next(new Error('Password must be a string'));
    }
    
    // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$')) {
      return next();
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    console.error('[PaymentAdmin Schema] Error hashing password:', {
      message: error.message,
      stack: error.stack,
    });
    return next(error);
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

