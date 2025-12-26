const mongoose = require('mongoose');

const botSchema = new mongoose.Schema(
  {
    botId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    avatarUrl: { type: String, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

botSchema.index({ botId: 1 });
botSchema.index({ isActive: 1 });

module.exports = mongoose.models.Bot || mongoose.model('Bot', botSchema);

