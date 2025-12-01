const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    gameNumber: {
      type: Number,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'predictions', 'racing', 'finished'],
      default: 'waiting',
    },
    cars: [
      {
        carId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Car',
          required: true,
        },
        trackNumber: {
          type: Number,
          required: true,
          min: 1,
          max: 3,
        },
      },
    ],
    tracks: [
      {
        segments: [
          {
            type: String,
            enum: ['regular', 'desert', 'muddy'],
          },
        ],
      },
    ],
    startTime: {
      type: Date,
      required: true,
    },
    predictionEndTime: {
      type: Date,
    },
    raceStartTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    winnerCarId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Car',
    },
    results: [
      {
        carId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Car',
        },
        trackNumber: Number,
        totalTime: Number,
        segmentTimes: [Number],
        position: Number,
      },
    ],
    totalPot: {
      type: Number,
      default: 0,
    },
    platformFee: {
      type: Number,
      default: 0,
    },
    winnerPayout: {
      type: Number,
      default: 0,
    },
    totalPredictions: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
gameSchema.index({ status: 1, createdAt: -1 });
gameSchema.index({ gameNumber: 1 });

module.exports = mongoose.model('Game', gameSchema);

