const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const Admin = require('../schemas/admin');
const PaymentAdmin = require('../schemas/paymentAdmin');
const PaymentMethod = require('../schemas/paymentMethod');
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
        { expiresIn: '10y' } // 10 years - effectively never expires
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
  const requestStartTime = Date.now();
  
  // Log incoming request info immediately
  console.log('[Admin Routes] ===== UPLOAD REQUEST START =====');
  console.log('[Admin Routes] Upload request received:', {
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    hasBody: !!req.body,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Set a timeout to catch if multer hangs (5 minutes for large files)
  const multerTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[Admin Routes] MULTER TIMEOUT - No response after 5 minutes');
      console.error('[Admin Routes] Request details:', {
        elapsed: Date.now() - requestStartTime,
        hasFile: !!req.file,
        headersSent: res.headersSent,
        finished: res.finished
      });
      if (!res.headersSent && !res.finished) {
        res.status(504).json({ error: 'Upload processing timeout. File may be too large or server is overloaded.' });
      }
    }
  }, 300000); // 5 minutes

  // Handle multer errors first
  uploadCar.single('image')(req, res, (err) => {
    clearTimeout(multerTimeout); // Clear timeout when multer completes
    if (err) {
      console.error('[Admin Routes] Multer error:', {
        code: err.code,
        message: err.message,
        field: err.field,
        name: err.name,
        stack: err.stack,
        originalError: err.toString()
      });
      
      let errorMessage = 'File upload failed';
      let statusCode = 400;
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        errorMessage = 'File is too large. Please try a smaller file.';
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        errorMessage = 'Unexpected file field. Please use "image" as the field name.';
      } else if (err.code === 'LIMIT_PART_COUNT') {
        errorMessage = 'Too many parts in the request.';
      } else if (err.code === 'LIMIT_PART_FIELD_COUNT') {
        errorMessage = 'Too many fields in the request.';
      } else if (err.code === 'LIMIT_FIELD_KEY') {
        errorMessage = 'Field name is too long.';
      } else if (err.code === 'LIMIT_FIELD_VALUE') {
        errorMessage = 'Field value is too long.';
      } else if (err.code === 'LIMIT_FIELD_COUNT') {
        errorMessage = 'Too many fields in the form.';
      } else if (err.code === 'ENOENT') {
        errorMessage = 'Upload directory does not exist. Contact server administrator.';
        statusCode = 500;
      } else if (err.code === 'EACCES' || err.code === 'EPERM') {
        errorMessage = 'Permission denied. Upload directory is not writable. Contact server administrator.';
        statusCode = 500;
      } else if (err.code === 'ENOSPC') {
        errorMessage = 'No space left on server. Contact server administrator.';
        statusCode = 500;
      } else if (err.code === 'EMFILE' || err.code === 'ENFILE') {
        errorMessage = 'Too many open files. Server resource limit reached. Contact server administrator.';
        statusCode = 500;
      } else if (err.message) {
        errorMessage = `Upload error: ${err.message}`;
      }
      
      // Make sure response hasn't been sent
      if (!res.headersSent) {
        return res.status(statusCode).json({ error: errorMessage });
      } else {
        console.error('[Admin Routes] Response already sent, cannot send error response');
      }
    } else {
      console.log('[Admin Routes] Multer processing completed, calling next()');
      next();
    }
  });
}, async (req, res, next) => {
  console.log('[Admin Routes] ===== UPLOAD HANDLER START =====');
  let uploadedFilePath = null;
  const startTime = Date.now();
  
  // Set keep-alive to prevent connection from closing (5 minutes for large files)
  res.setTimeout(300000, () => {
    console.error('[Admin Routes] Response timeout - connection closed after 5 minutes');
  });
  
  // Set response timeout to prevent hanging
  const responseTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[Admin Routes] Response timeout - no response sent after 30 seconds');
      console.error('[Admin Routes] Request details:', {
        method: req.method,
        url: req.url,
        hasFile: !!req.file,
        fileSize: req.file?.size,
        headersSent: res.headersSent,
        finished: res.finished
      });
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (unlinkError) {
          console.error('[Admin Routes] Error cleaning up file on timeout:', unlinkError);
        }
      }
      if (!res.headersSent && !res.finished) {
        try {
          res.status(504).json({ error: 'Request timeout. File processing took too long.' });
          if (typeof res.flush === 'function') {
            res.flush();
          }
        } catch (timeoutError) {
          console.error('[Admin Routes] Error sending timeout response:', timeoutError);
        }
      }
    }
  }, 300000); // 5 minute timeout for response (for large files up to 100MB)
  
  // Add request error handler
  req.on('error', (error) => {
    console.error('[Admin Routes] Request error:', error);
    clearTimeout(responseTimeout);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Request error occurred' });
    }
  });
  
  // Add response error handler
  res.on('error', (error) => {
    console.error('[Admin Routes] Response error:', error);
    clearTimeout(responseTimeout);
  });
  
  try {
    console.log('[Admin Routes] Processing uploaded file:', {
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      filePath: req.file?.path,
      mimetype: req.file?.mimetype,
      carName: req.body?.carName,
      imageType: req.body?.imageType
    });

    if (!req.file) {
      console.error('[Admin Routes] No file in request');
      clearTimeout(responseTimeout);
      return res.status(400).json({ error: 'No file provided. Please select an image file.' });
    }

    uploadedFilePath = req.file.path;

    // Quick validation - don't do heavy checks that might hang
    try {
      // Verify file was actually saved (quick check)
      if (!fs.existsSync(uploadedFilePath)) {
        clearTimeout(responseTimeout);
        return res.status(500).json({ error: 'File was not saved properly. Check server disk space and permissions.' });
      }

      // Check file size (quick check)
      const stats = fs.statSync(uploadedFilePath);
      if (stats.size === 0) {
        fs.unlinkSync(uploadedFilePath);
        clearTimeout(responseTimeout);
        return res.status(500).json({ error: 'File was saved but is empty (0 bytes). File may be corrupted or disk is full.' });
      }
      
      // Skip disk space check to avoid hanging - just verify file exists and has size
      console.log('[Admin Routes] File validation passed:', {
        exists: true,
        size: stats.size,
        path: uploadedFilePath
      });
    } catch (fsError) {
      console.error('[Admin Routes] File system error:', fsError);
      clearTimeout(responseTimeout);
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (unlinkError) {
          console.error('[Admin Routes] Error cleaning up file:', unlinkError);
        }
      }
      if (!res.headersSent) {
        return res.status(500).json({ 
          error: `File system error: ${fsError.message || 'Unable to save file. Check server disk space and permissions.'}` 
        });
      }
      return;
    }

    // Use original file directly - no optimization
    const relativePath = path.relative(path.join(__dirname, '../uploads'), uploadedFilePath);
    const imageUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;
    
    const processingTime = Date.now() - startTime;
    console.log('[Admin Routes] File uploaded successfully:', {
      originalName: req.file.originalname,
      savedPath: uploadedFilePath,
      imageUrl: imageUrl,
      size: req.file.size,
      mimetype: req.file.mimetype,
      carName: req.body?.carName || 'N/A',
      imageType: req.body?.imageType || 'N/A',
      processingTimeMs: processingTime
    });
    
    // Clear timeout and send response
    clearTimeout(responseTimeout);
    
    // Ensure response is sent immediately
    if (!res.headersSent && !res.finished) {
      console.log('[Admin Routes] Sending success response...', { imageUrl, processingTime: Date.now() - startTime });
      
      // Use res.json() which handles everything properly
      res.status(200).json({ imageUrl });
      
      // Log after sending
      console.log('[Admin Routes] Success response sent', {
        headersSent: res.headersSent,
        finished: res.finished,
        statusCode: res.statusCode
      });
      
      // Try to flush if available (for HTTP/1.1 keep-alive)
      if (typeof res.flush === 'function') {
        try {
          res.flush();
        } catch (flushError) {
          // Flush errors are usually harmless
          console.warn('[Admin Routes] Flush warning (usually harmless):', flushError.message);
        }
      }
    } else {
      console.error('[Admin Routes] WARNING: Cannot send response', {
        headersSent: res.headersSent,
        finished: res.finished
      });
    }
  } catch (error) {
    clearTimeout(responseTimeout); // Clear timeout on error
    
    console.error('[Admin Routes] Error uploading file:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      name: error.name,
      type: error.constructor?.name,
      file: req.file ? {
        originalname: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null,
      requestInfo: {
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
        method: req.method,
        url: req.url
      }
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
    
    // Make sure response hasn't been sent
    if (!res.headersSent) {
      console.log('[Admin Routes] Sending error response...', { errorMessage });
      try {
        res.status(500).json({ error: errorMessage });
        // Force flush the response
        if (typeof res.flush === 'function') {
          res.flush();
        }
        console.log('[Admin Routes] Error response sent and flushed');
      } catch (sendError) {
        console.error('[Admin Routes] Error sending error response:', sendError);
      }
    } else {
      console.error('[Admin Routes] Response already sent, cannot send error response');
    }
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

// Payment Admin Management Routes

// Get all payment admins
router.get('/payment-admins', authenticateAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    const paymentAdmins = await PaymentAdmin.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PaymentAdmin.countDocuments(query);

    res.json({
      paymentAdmins,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

// Create payment admin
router.post('/payment-admins', authenticateAdmin, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if payment admin already exists
    const existingPaymentAdmin = await PaymentAdmin.findOne({ email: email.toLowerCase().trim() });
    if (existingPaymentAdmin) {
      return res.status(400).json({ error: 'Payment administrator with this email already exists' });
    }

    // Store plain password before hashing (to return in response)
    const plainPassword = password;

    // Hash password manually before saving (simple approach)
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    // Create payment admin with hashed password
    let paymentAdmin;
    try {
      paymentAdmin = await PaymentAdmin.create({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        isActive: true,
      });
    } catch (createError) {
      console.error('[Admin Routes] PaymentAdmin.create() error:', {
        message: createError.message,
        code: createError.code,
        name: createError.name,
        errors: createError.errors,
        stack: createError.stack,
      });
      
      if (createError.code === 11000) {
        return res.status(400).json({ error: 'Payment administrator with this email already exists' });
      }
      if (createError.name === 'ValidationError') {
        const validationErrors = Object.values(createError.errors || {}).map(err => err.message).join(', ');
        return res.status(400).json({ error: validationErrors || createError.message });
      }
      throw createError;
    }

    // Return payment admin data with plain password (for admin to share)
    const paymentAdminData = paymentAdmin.toObject();
    delete paymentAdminData.password;
    
    // Add plain password to response so admin can share it
    res.json({
      message: 'Payment administrator created successfully',
      paymentAdmin: paymentAdminData,
      credentials: {
        email: email.toLowerCase().trim(),
        password: plainPassword, // Return plain password for sharing
      },
    });
  } catch (error) {
    console.error('[Admin Routes] Error creating payment admin:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    });
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Payment administrator with this email already exists' });
    }
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors || {}).map(err => err.message).join(', ');
      return res.status(400).json({ error: validationErrors || error.message });
    }
    // Return a more user-friendly error message
    return res.status(500).json({ 
      error: 'Failed to create payment administrator. Please check server logs for details.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update payment admin
router.put('/payment-admins/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const { name, password, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      // Hash password manually before updating
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const paymentAdmin = await PaymentAdmin.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!paymentAdmin) {
      return res.status(404).json({ error: 'Payment administrator not found' });
    }

    res.json({
      message: 'Payment administrator updated successfully',
      paymentAdmin,
    });
  } catch (error) {
    next(error);
  }
});

// Delete payment admin
router.delete('/payment-admins/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const paymentAdmin = await PaymentAdmin.findByIdAndDelete(req.params.id);

    if (!paymentAdmin) {
      return res.status(404).json({ error: 'Payment administrator not found' });
    }

    res.json({ message: 'Payment administrator deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Payment Methods Management

// Get all payment methods
router.get('/payment-methods', authenticateAdmin, async (req, res, next) => {
  try {
    const paymentMethods = await PaymentMethod.find()
      .sort({ createdAt: -1 });
    res.json({ paymentMethods });
  } catch (error) {
    next(error);
  }
});

// Create payment method
router.post('/payment-methods', authenticateAdmin, async (req, res, next) => {
  try {
    const { name, type, details, isActive } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const paymentMethod = await PaymentMethod.create({
      name: name.trim(),
      type,
      details: details || {},
      isActive: isActive !== false,
      addedBy: req.adminId,
    });

    res.json({
      message: 'Payment method created successfully',
      paymentMethod,
    });
  } catch (error) {
    next(error);
  }
});

// Update payment method
router.put('/payment-methods/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const { name, type, details, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (type) updateData.type = type;
    if (details) updateData.details = details;
    if (isActive !== undefined) updateData.isActive = isActive;

    const paymentMethod = await PaymentMethod.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    res.json({
      message: 'Payment method updated successfully',
      paymentMethod,
    });
  } catch (error) {
    next(error);
  }
});

// Delete payment method
router.delete('/payment-methods/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const paymentMethod = await PaymentMethod.findByIdAndDelete(req.params.id);

    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    res.json({ message: 'Payment method deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

