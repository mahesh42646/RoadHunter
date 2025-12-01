const mongoose = require('mongoose');

const carSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    topViewImage: {
      type: String,
      required: true,
    },
    sideViewImage: {
      type: String,
      required: true,
    },
    speedRegular: {
      type: Number,
      required: true,
      min: 20,
      max: 150,
    },
    speedDesert: {
      type: Number,
      required: true,
      min: 20,
      max: 150,
    },
    speedMuddy: {
      type: Number,
      required: true,
      min: 20,
      max: 150,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Allow null for admin-created cars
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Car', carSchema);

