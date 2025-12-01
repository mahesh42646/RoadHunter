const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema(
  {
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    predictedCarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Car',
      required: true,
    },
    betAmount: {
      type: Number,
      required: true,
      default: 100,
    },
    isCorrect: {
      type: Boolean,
      default: null,
    },
    payout: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Party',
      required: false, // Optional - user might not be in a party
    },
  },
  {
    timestamps: false,
  }
);

// Index for faster queries (allow multiple predictions per user per game)
predictionSchema.index({ gameId: 1, userId: 1, predictedCarId: 1 });
predictionSchema.index({ gameId: 1 });
predictionSchema.index({ userId: 1 });

module.exports = mongoose.model('Prediction', predictionSchema);

