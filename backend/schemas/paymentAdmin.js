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
    },
    password: {
      type: String,
      required: true,
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

