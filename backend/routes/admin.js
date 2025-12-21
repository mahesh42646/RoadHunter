const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const Admin = require('../schemas/admin');
const Car = require('../schemas/car');
const Game = require('../schemas/game');
const Prediction = require('../schemas/prediction');
const User = require('../schemas/users');
const uploadCar = require('../middleware/uploadCar');
const { optimizeImage, getOptimizedPath } = require('../utils/imageOptimizer');

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
    try {
      admin.lastLogin = new Date();
      await admin.save();
    } catch (saveError) {
      console.error('[Admin Login] Error saving last login:', saveError);
      // Continue with login even if saving last login fails
    }

    // Generate JWT token for admin (separate from user tokens)
    let token;
    try {
      token = jwt.sign(
        { 
          sub: admin._id.toString(), 
          email: admin.email,
          type: 'admin' // Distinguish admin tokens from user tokens
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
    } catch (tokenError) {
      console.error('[Admin Login] Error generating token:', tokenError);
      return res.status(500).json({ error: 'Failed to generate authentication token' });
    }

    // Prepare response data
    const responseData = {
      message: 'Login successful',
      token,
      admin: {
        _id: admin._id,
        email: admin.email,
        name: admin.name,
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error('[Admin Login] Unexpected error:', error);
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

// Image upload endpoint for cars - no validations, accept any file
router.post('/cars/upload', authenticateAdmin, (req, res, next) => {
  // Handle multer errors first
  uploadCar.single('image')(req, res, (err) => {
    if (err) {
      console.error('[Admin Routes] Multer error:', {
        code: err.code,
        message: err.message,
        field: err.field,
        stack: err.stack
      });
      
      let errorMessage = 'File upload failed';
      let statusCode = 400;
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        errorMessage = 'File is too large. Please try a smaller file.';
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        errorMessage = 'Unexpected file field. Please use "image" as the field name.';
      } else if (err.code === 'ENOENT') {
        errorMessage = 'Upload directory does not exist. Contact server administrator.';
        statusCode = 500;
      } else if (err.code === 'EACCES' || err.code === 'EPERM') {
        errorMessage = 'Permission denied. Upload directory is not writable. Contact server administrator.';
        statusCode = 500;
      } else if (err.code === 'ENOSPC') {
        errorMessage = 'No space left on server. Contact server administrator.';
        statusCode = 500;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      return res.status(statusCode).json({ error: errorMessage });
    }
    next();
  });
}, async (req, res) => {
  let uploadedFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Please select an image file.' });
    }

    uploadedFilePath = req.file.path;

    // Check file system health
    try {
      // Verify file was actually saved
      if (!fs.existsSync(uploadedFilePath)) {
        return res.status(500).json({ error: 'File was not saved properly. Check server disk space and permissions.' });
      }

      // Check file size matches what was uploaded
      const stats = fs.statSync(uploadedFilePath);
      if (stats.size === 0) {
        fs.unlinkSync(uploadedFilePath);
        return res.status(500).json({ error: 'File was saved but is empty (0 bytes). File may be corrupted or disk is full.' });
      }

      // Check available disk space (rough estimate)
      try {
        const uploadsDir = path.dirname(uploadedFilePath);
        const testFile = path.join(uploadsDir, '.space-check');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (spaceError) {
        console.error('[Admin Routes] Disk space check failed:', spaceError);
        if (fs.existsSync(uploadedFilePath)) {
          fs.unlinkSync(uploadedFilePath);
        }
        return res.status(500).json({ error: 'Server disk space issue. File could not be saved. Contact administrator.' });
      }
    } catch (fsError) {
      console.error('[Admin Routes] File system error:', fsError);
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (unlinkError) {
          console.error('[Admin Routes] Error cleaning up file:', unlinkError);
        }
      }
      return res.status(500).json({ 
        error: `File system error: ${fsError.message || 'Unable to save file. Check server disk space and permissions.'}` 
      });
    }

    // Use original file directly - no optimization
    const relativePath = path.relative(path.join(__dirname, '../uploads'), uploadedFilePath);
    const imageUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;
    
    console.log('[Admin Routes] File uploaded successfully:', {
      originalName: req.file.originalname,
      savedPath: uploadedFilePath,
      imageUrl: imageUrl,
      size: req.file.size,
      mimetype: req.file.mimetype,
      carName: req.body?.carName || 'N/A',
      imageType: req.body?.imageType || 'N/A'
    });
    
    res.json({ imageUrl });
  } catch (error) {
    console.error('[Admin Routes] Error uploading file:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      file: req.file ? {
        originalname: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null
    });
    
    // Clean up uploaded file on error
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
        console.log('[Admin Routes] Cleaned up uploaded file:', uploadedFilePath);
      } catch (unlinkError) {
        console.error('[Admin Routes] Error deleting uploaded file:', unlinkError);
      }
    }
    
    // Provide specific error messages
    let errorMessage = 'Failed to upload file.';
    
    if (error.code === 'ENOENT') {
      errorMessage = 'Upload directory does not exist. Contact server administrator.';
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
      errorMessage = 'Permission denied. Upload directory is not writable. Contact server administrator.';
    } else if (error.code === 'ENOSPC') {
      errorMessage = 'No space left on server. Contact server administrator.';
    } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
      errorMessage = 'Too many open files. Server resource limit reached. Contact server administrator.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Car management routes (already exist in games.js, but adding here for admin dashboard)
router.get('/cars', authenticateAdmin, async (req, res, next) => {
  try {
    const cars = await Car.find()
      .populate('createdBy', 'account.displayName')
      .sort({ createdAt: -1 });
    
    // Get statistics for each car
    const carsWithStats = await Promise.all(cars.map(async (car) => {
      const carId = car._id;
      
      // Games where this car participated
      const gamesPlayed = await Game.countDocuments({
        'cars.carId': carId,
        status: 'finished',
      });
      
      // Games where this car won
      const wins = await Game.countDocuments({
        winnerCarId: carId,
        status: 'finished',
      });
      
      // Total predictions (selections) for this car
      const predictions = await Prediction.find({ predictedCarId: carId });
      const totalSelections = predictions.length;
      
      // Unique users who selected this car
      const uniqueUsers = new Set(predictions.map(p => p.userId.toString()));
      const totalUsers = uniqueUsers.size;
      
      // Total coins spent on this car
      const totalCoins = predictions.reduce((sum, p) => sum + (p.betAmount || 100), 0);
      
      // Games where this car was assigned (participated in any status)
      const totalGamesAssigned = await Game.countDocuments({
        'cars.carId': carId,
      });
      
      return {
        ...car.toObject(),
        stats: {
          gamesPlayed,
          wins,
          totalSelections,
          totalUsers,
          totalCoins,
          totalGamesAssigned,
          winRate: gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : '0.0',
        },
      };
    }));
    
    res.json({ cars: carsWithStats });
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

    // Validate image URLs (must be /uploads/ paths or valid URLs)
    if (!topViewImage.startsWith('/uploads/') && !topViewImage.startsWith('http')) {
      return res.status(400).json({ error: 'Top view image must be a valid uploaded image URL' });
    }
    if (!sideViewImage.startsWith('/uploads/') && !sideViewImage.startsWith('http')) {
      return res.status(400).json({ error: 'Side view image must be a valid uploaded image URL' });
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
    if (name) updateData.name = name.trim();
    if (topViewImage) {
      // Validate image URL (must be /uploads/ paths or valid URLs)
      if (!topViewImage.startsWith('/uploads/') && !topViewImage.startsWith('http')) {
        return res.status(400).json({ error: 'Top view image must be a valid uploaded image URL' });
      }
      updateData.topViewImage = topViewImage.trim();
    }
    if (sideViewImage) {
      // Validate image URL (must be /uploads/ paths or valid URLs)
      if (!sideViewImage.startsWith('/uploads/') && !sideViewImage.startsWith('http')) {
        return res.status(400).json({ error: 'Side view image must be a valid uploaded image URL' });
      }
      updateData.sideViewImage = sideViewImage.trim();
    }
    if (speedRegular) {
      const speedRegularNum = parseInt(speedRegular);
      if (isNaN(speedRegularNum) || speedRegularNum < 20 || speedRegularNum > 150) {
        return res.status(400).json({ error: 'Regular speed must be between 20 and 150 km/h' });
      }
      updateData.speedRegular = speedRegularNum;
    }
    if (speedDesert) {
      const speedDesertNum = parseInt(speedDesert);
      if (isNaN(speedDesertNum) || speedDesertNum < 20 || speedDesertNum > 150) {
        return res.status(400).json({ error: 'Desert speed must be between 20 and 150 km/h' });
      }
      updateData.speedDesert = speedDesertNum;
    }
    if (speedMuddy) {
      const speedMuddyNum = parseInt(speedMuddy);
      if (isNaN(speedMuddyNum) || speedMuddyNum < 20 || speedMuddyNum > 150) {
        return res.status(400).json({ error: 'Muddy speed must be between 20 and 150 km/h' });
      }
      updateData.speedMuddy = speedMuddyNum;
    }
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

    // Filter out cars with null carId (deleted cars) from each game
    const gamesWithValidCars = games.map((game) => {
      const gameObj = game.toObject();
      if (gameObj.cars) {
        gameObj.cars = gameObj.cars.filter((car) => car.carId && car.carId._id);
      }
      return gameObj;
    });

    const total = await Game.countDocuments();

    res.json({ games: gamesWithValidCars, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

