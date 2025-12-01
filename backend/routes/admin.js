const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../schemas/admin');
const Car = require('../schemas/car');
const Game = require('../schemas/game');
const Prediction = require('../schemas/prediction');
const User = require('../schemas/users');

const { JWT_SECRET = 'change-me' } = process.env;

// Admin login - validates against database
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({ error: 'Admin account is deactivated' });
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token for admin (separate from user tokens)
    const token = jwt.sign(
      { 
        sub: admin._id.toString(), 
        email: admin.email,
        type: 'admin' // Distinguish admin tokens from user tokens
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      admin: {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Middleware to verify admin authentication
async function authenticateAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    
    // Verify token is admin type (not user token)
    if (payload.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Verify admin exists and is active
    const admin = await Admin.findById(payload.sub);
    if (!admin || !admin.isActive) {
      return res.status(403).json({ error: 'Admin account not found or inactive' });
    }
    
    req.admin = admin;
    req.adminId = payload.sub;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Get dashboard analytics
router.get('/analytics', authenticateAdmin, async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalGames = await Game.countDocuments();
    const totalPredictions = await Prediction.countDocuments();
    const finishedGames = await Game.countDocuments({ status: 'finished' });
    
    // Total coins wagered
    const totalWagered = await Prediction.aggregate([
      { $group: { _id: null, total: { $sum: '$betAmount' } } },
    ]);
    const totalWageredAmount = totalWagered[0]?.total || 0;
    
    // Total platform fees
    const totalFees = await Game.aggregate([
      { $match: { status: 'finished' } },
      { $group: { _id: null, total: { $sum: '$platformFee' } } },
    ]);
    const totalFeesAmount = totalFees[0]?.total || 0;
    
    // Active games
    const activeGames = await Game.countDocuments({
      status: { $in: ['waiting', 'predictions', 'racing'] },
    });
    
    // Recent games (last 10)
    const recentGames = await Game.find({ status: 'finished' })
      .populate('winnerCarId', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('gameNumber totalPot platformFee winnerPayout totalPredictions createdAt winnerCarId');
    
    // Car win statistics
    const carWins = await Game.aggregate([
      { $match: { status: 'finished', winnerCarId: { $exists: true } } },
      { $group: { _id: '$winnerCarId', wins: { $sum: 1 } } },
      { $sort: { wins: -1 } },
      { $limit: 10 },
    ]);
    
    const carWinDetails = await Car.find({
      _id: { $in: carWins.map((c) => c._id) },
    });
    
    const carStats = carWins.map((win) => {
      const car = carWinDetails.find((c) => c._id.toString() === win._id.toString());
      return {
        carId: win._id,
        carName: car?.name || 'Unknown',
        wins: win.wins,
      };
    });
    
    // User participation stats
    const userStats = await Prediction.aggregate([
      {
        $group: {
          _id: '$userId',
          totalPredictions: { $sum: 1 },
          wins: { $sum: { $cond: ['$isCorrect', 1, 0] } },
          totalWagered: { $sum: '$betAmount' },
          totalWon: { $sum: '$payout' },
        },
      },
      { $sort: { totalPredictions: -1 } },
      { $limit: 10 },
    ]);
    
    const userIds = userStats.map((s) => s._id);
    const users = await User.find({ _id: { $in: userIds } });
    const userStatsWithNames = userStats.map((stat) => {
      const user = users.find((u) => u._id.toString() === stat._id.toString());
      return {
        userId: stat._id,
        username: user?.account?.displayName || 'Unknown',
        totalPredictions: stat.totalPredictions,
        wins: stat.wins,
        winRate: stat.totalPredictions > 0 
          ? ((stat.wins / stat.totalPredictions) * 100).toFixed(2) 
          : 0,
        totalWagered: stat.totalWagered,
        totalWon: stat.totalWon,
        netProfit: stat.totalWon - stat.totalWagered,
      };
    });
    
    res.json({
      overview: {
        totalUsers,
        totalGames,
        totalPredictions,
        finishedGames,
        activeGames,
        totalWagered: totalWageredAmount,
        totalFees: totalFeesAmount,
      },
      recentGames,
      carStats,
      topUsers: userStatsWithNames,
    });
  } catch (error) {
    next(error);
  }
});

// Get all users with pagination
router.get('/users', authenticateAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = {};
    if (search) {
      query.$or = [
        { 'account.displayName': { $regex: search, $options: 'i' } },
        { 'account.email': { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('account wallet isAdmin createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    // Get user stats
    const userIds = users.map((u) => u._id);
    const predictions = await Prediction.aggregate([
      { $match: { userId: { $in: userIds } } },
      {
        $group: {
          _id: '$userId',
          totalPredictions: { $sum: 1 },
          wins: { $sum: { $cond: ['$isCorrect', 1, 0] } },
          totalWagered: { $sum: '$betAmount' },
          totalWon: { $sum: '$payout' },
        },
      },
    ]);

    const usersWithStats = users.map((user) => {
      const stats = predictions.find(
        (p) => p._id.toString() === user._id.toString()
      );
      return {
        ...user.toObject(),
        stats: stats || {
          totalPredictions: 0,
          wins: 0,
          totalWagered: 0,
          totalWon: 0,
        },
      };
    });

    res.json({
      users: usersWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// Update user (ban/unban, admin status, etc.)
router.put('/users/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const { isBanned, isAdmin: setIsAdmin } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isBanned,
        isAdmin: setIsAdmin,
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    next(error);
  }
});

// Get transactions (predictions with user info)
router.get('/transactions', authenticateAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const gameId = req.query.gameId;

    const query = {};
    if (gameId) {
      query.gameId = gameId;
    }

    const predictions = await Prediction.find(query)
      .populate('userId', 'account.displayName account.email')
      .populate('gameId', 'gameNumber status totalPot')
      .populate('predictedCarId', 'name')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Prediction.countDocuments(query);

    res.json({
      transactions: predictions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// Car management routes (already exist in games.js, but adding here for admin dashboard)
router.get('/cars', authenticateAdmin, async (req, res, next) => {
  try {
    const cars = await Car.find()
      .populate('createdBy', 'account.displayName')
      .sort({ createdAt: -1 });
    res.json({ cars });
  } catch (error) {
    next(error);
  }
});

router.post('/cars', authenticateAdmin, async (req, res, next) => {
  try {
    const { name, topViewImage, sideViewImage, speedRegular, speedDesert, speedMuddy, isActive } = req.body;

    if (!name || !topViewImage || !sideViewImage || !speedRegular || !speedDesert || !speedMuddy) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate speeds are numbers
    const speedRegularNum = parseInt(speedRegular);
    const speedDesertNum = parseInt(speedDesert);
    const speedMuddyNum = parseInt(speedMuddy);

    if (isNaN(speedRegularNum) || isNaN(speedDesertNum) || isNaN(speedMuddyNum)) {
      return res.status(400).json({ error: 'All speeds must be valid numbers' });
    }

    // Validate speed ranges
    if (speedRegularNum < 20 || speedRegularNum > 150 || 
        speedDesertNum < 20 || speedDesertNum > 150 || 
        speedMuddyNum < 20 || speedMuddyNum > 150) {
      return res.status(400).json({ error: 'All speeds must be between 20 and 150 km/h' });
    }

    // Admin-created cars don't have a User creator, so we use null
    // But since createdBy is not required anymore, we can omit it
    const car = await Car.create({
      name: name.trim(),
      topViewImage: topViewImage.trim(),
      sideViewImage: sideViewImage.trim(),
      speedRegular: speedRegularNum,
      speedDesert: speedDesertNum,
      speedMuddy: speedMuddyNum,
      isActive: isActive !== false,
      // createdBy is optional now, so we can omit it for admin-created cars
    });

    res.json({ message: 'Car created successfully', car });
  } catch (error) {
    console.error('[Admin Routes] Error creating car:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.put('/cars/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const { name, topViewImage, sideViewImage, speedRegular, speedDesert, speedMuddy, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (topViewImage) updateData.topViewImage = topViewImage;
    if (sideViewImage) updateData.sideViewImage = sideViewImage;
    if (speedRegular) updateData.speedRegular = parseInt(speedRegular);
    if (speedDesert) updateData.speedDesert = parseInt(speedDesert);
    if (speedMuddy) updateData.speedMuddy = parseInt(speedMuddy);
    if (isActive !== undefined) updateData.isActive = isActive;

    const car = await Car.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    res.json({ message: 'Car updated successfully', car });
  } catch (error) {
    next(error);
  }
});

router.delete('/cars/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const car = await Car.findByIdAndDelete(req.params.id);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    res.json({ message: 'Car deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get all games
router.get('/games', authenticateAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const games = await Game.find()
      .populate('cars.carId')
      .populate('winnerCarId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Game.countDocuments();

    res.json({ games, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

