const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Bot = require('../schemas/bot');
const Party = require('../schemas/party');
const User = require('../schemas/users');

const DEFAULT_BOTS = [
  { botId: 'bot-001', name: 'Alex', username: 'AlexBot', description: 'Gaming enthusiast and party host' },
  { botId: 'bot-002', name: 'Maya', username: 'MayaBot', description: 'Music lover and social butterfly' },
  { botId: 'bot-003', name: 'Sam', username: 'SamBot', description: 'Tech geek and conversation starter' },
  { botId: 'bot-004', name: 'Luna', username: 'LunaBot', description: 'Art lover and creative mind' },
  { botId: 'bot-005', name: 'Max', username: 'MaxBot', description: 'Sports fan and team player' },
  { botId: 'bot-006', name: 'Zoe', username: 'ZoeBot', description: 'Fashionista and trendsetter' },
];

const DEFAULT_PARTIES = [
  { name: 'Gaming Zone', description: 'Join us for epic gaming sessions and tournaments!' },
  { botIndex: 0 },
  { name: 'Music Vibes', description: 'Share your favorite tracks and discover new music!' },
  { botIndex: 1 },
  { name: 'Tech Talk', description: 'Discuss the latest tech trends and innovations!' },
  { botIndex: 2 },
  { name: 'Creative Corner', description: 'Showcase your art and creative projects!' },
  { botIndex: 3 },
  { name: 'Sports Hub', description: 'Talk about your favorite teams and matches!' },
  { botIndex: 4 },
  { name: 'Fashion Forward', description: 'Share style tips and fashion inspiration!' },
  { botIndex: 5 },
];

async function initDefaultParties() {
  try {
    const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!MONGO_URI) {
      throw new Error('Missing MONGODB_URI in environment variables');
    }

    await mongoose.connect(MONGO_URI);
    console.log('[Init Default Parties] Connected to MongoDB');

    // Create or update bots
    const bots = [];
    for (const botData of DEFAULT_BOTS) {
      let bot = await Bot.findOne({ botId: botData.botId });
      if (!bot) {
        bot = await Bot.create(botData);
        console.log(`[Init Default Parties] Created bot: ${bot.name} (${bot.botId})`);
      } else {
        // Update existing bot
        bot.name = botData.name;
        bot.username = botData.username;
        bot.description = botData.description;
        bot.isActive = true;
        await bot.save();
        console.log(`[Init Default Parties] Updated bot: ${bot.name} (${bot.botId})`);
      }
      bots.push(bot);
    }

    // Create a special bot user account for each bot (for hostId reference)
    // We'll use a special prefix to identify bot users
    const botUsers = [];
    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      let botUser = await User.findOne({ 'account.displayName': `Bot_${bot.botId}` });
      
      if (!botUser) {
        botUser = await User.create({
          account: {
            displayName: `Bot_${bot.botId}`,
            username: bot.username,
            profileCompleted: true,
            gender: 'prefer-not-to-say',
            status: 'active',
            isQuickLogin: false,
          },
          quickLoginId: `bot-${bot.botId}-${Date.now()}`,
          auth: {
            lastLoginAt: new Date(),
            lastIp: '127.0.0.1',
          },
          wallet: {
            walletId: User.generateWalletId(),
            balanceUsd: 0,
            partyCoins: 0,
          },
          progress: {
            level: 1,
            xp: 0,
            nextLevelAt: 100,
          },
          social: {
            profilePrivacy: 'public',
            friends: [],
            friendRequests: { sent: [], received: [] },
            followRequests: { sent: [], received: [] },
            removedFriends: [],
            removedBy: [],
            followers: [],
            following: [],
            blockedUsers: [],
          },
        });
        console.log(`[Init Default Parties] Created bot user: ${botUser.account.displayName}`);
      }
      botUsers.push(botUser);
    }

    // Create or update default parties
    for (let i = 0; i < DEFAULT_PARTIES.length; i += 2) {
      const partyData = DEFAULT_PARTIES[i];
      const botIndex = DEFAULT_PARTIES[i + 1].botIndex;
      const bot = bots[botIndex];
      const botUser = botUsers[botIndex];

      let party = await Party.findOne({ isDefault: true, name: partyData.name });
      
      if (!party) {
        party = await Party.create({
          name: partyData.name,
          description: partyData.description,
          privacy: 'public',
          hostId: botUser._id,
          hostUsername: bot.name,
          hostAvatarUrl: bot.avatarUrl || null,
          isDefault: true,
          botHostId: bot._id,
          isActive: true,
          startedAt: new Date(),
          hostMicEnabled: false,
          hostCameraEnabled: false,
          botCameraEnabled: false,
          botMicEnabled: false,
        });

        // Add bot as host participant
        party.addParticipant(botUser._id, bot.name, bot.avatarUrl || null, 'host');
        await party.save();
        console.log(`[Init Default Parties] Created default party: ${party.name}`);
      } else {
        // Update existing default party
        party.name = partyData.name;
        party.description = partyData.description;
        party.hostId = botUser._id;
        party.hostUsername = bot.name;
        party.hostAvatarUrl = bot.avatarUrl || null;
        party.botHostId = bot._id;
        party.isActive = true;
        party.isDefault = true;
        // Ensure bot is still a participant
        const botParticipant = party.participants.find(
          p => p.userId && p.userId.toString() === botUser._id.toString()
        );
        if (!botParticipant) {
          party.addParticipant(botUser._id, bot.name, bot.avatarUrl || null, 'host');
        }
        await party.save();
        console.log(`[Init Default Parties] Updated default party: ${party.name}`);
      }
    }

    console.log('[Init Default Parties] ✅ Default parties initialization complete');
    
    // Only close connection if called directly (not from server.js)
    if (require.main === module) {
      await mongoose.connection.close();
      process.exit(0);
    }
  } catch (error) {
    console.error('[Init Default Parties] ❌ Error:', error);
    
    // Only close connection if called directly (not from server.js)
    if (require.main === module) {
      await mongoose.connection.close();
      process.exit(1);
    }
    throw error; // Re-throw if called from server.js
  }
}

// Run if called directly
if (require.main === module) {
  initDefaultParties();
}

module.exports = initDefaultParties;

