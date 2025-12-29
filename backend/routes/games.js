const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Car = require('../schemas/car');
const Game = require('../schemas/game');
const Prediction = require('../schemas/prediction');
const User = require('../schemas/users');

const { JWT_SECRET = 'change-me' } = process.env;

// Authentication middleware
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to check if user is admin
async function isAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user._id || req.user.sub);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user._id = req.user._id || req.user.sub;
    next();
  } catch (error) {
    next(error);
  }
}

// Get active game (public)
router.get('/active', async (req, res, next) => {
  try {
    const game = await Game.findOne({
      status: { $in: ['waiting', 'predictions', 'racing'] },
    })
      .populate('cars.carId')
      .sort({ createdAt: -1 })
      .limit(1);

    if (!game) {
      return res.json({ game: null });
    }

    // Get prediction counts (number of selections per car)
    // Filter out cars with null carId (deleted cars)
    const validCars = game.cars.filter((car) => car.carId && car.carId._id);
    if (validCars.length === 0) {
      console.error('[Games Routes] Game has no valid cars:', game._id);
      return res.status(500).json({ error: 'Game has no valid cars' });
    }
    
    const predictions = await Prediction.find({ gameId: game._id });
    const counts = {};
    validCars.forEach((car) => {
      const carIdStr = car.carId._id.toString();
      counts[carIdStr] = predictions.filter(
        (p) => {
          const predCarId = p.predictedCarId?.toString() || p.predictedCarId?._id?.toString();
          return predCarId === carIdStr;
        }
      ).length;
    });
    
    // Update game.cars to only include valid cars
    game.cars = validCars;

    res.json({
      game: {
        ...game.toObject(),
        predictionCounts: counts,
        totalPredictions: predictions.length,
      },
      predictionCounts: counts, // Also return separately for easier access
    });
  } catch (error) {
    next(error);
  }
});

// Get user's predictions for active game (all selections)
router.get('/my-predictions', authenticate, async (req, res, next) => {
  try {
    const { gameId } = req.query;
    let game;
    
    if (gameId) {
      game = await Game.findById(gameId);
    } else {
      game = await Game.findOne({
        status: { $in: ['waiting', 'predictions', 'racing', 'finished'] },
      }).sort({ createdAt: -1 });
    }

    if (!game) {
      return res.json({ predictions: [] });
    }

    const userId = req.user._id || req.user.sub;
    console.log('[Games Routes] Fetching predictions for user:', userId, 'game:', game._id);
    
    const predictions = await Prediction.find({
      gameId: game._id,
      userId: userId,
    }).populate('predictedCarId').sort({ timestamp: 1 });

    console.log('[Games Routes] Found predictions:', predictions.map(p => ({
      _id: p._id,
      userId: p.userId?.toString(),
      predictedCarId: p.predictedCarId?._id?.toString(),
      predictedCarName: p.predictedCarId?.name,
      payout: p.payout,
      isCorrect: p.isCorrect
    })));

    // Group by car
    const selectionsByCar = {};
    predictions.forEach(pred => {
      const carId = pred.predictedCarId?._id?.toString() || pred.predictedCarId?.toString();
      if (!selectionsByCar[carId]) {
        selectionsByCar[carId] = [];
      }
      selectionsByCar[carId].push(pred);
    });

    res.json({ 
      predictions,
      selectionsByCar,
      totalSelections: predictions.length,
      totalInvested: predictions.length * 100,
    });
  } catch (error) {
    next(error);
  }
});

// Make a prediction (add or remove selection)
router.post('/predict', authenticate, async (req, res, next) => {
  try {
    const { carId, action = 'add', partyId } = req.body; // action: 'add' or 'remove'

    if (!carId) {
      return res.status(400).json({ error: 'Car ID is required' });
    }

    // Find active game
    const game = await Game.findOne({
      status: 'predictions',
    })
      .populate('cars.carId')
      .sort({ createdAt: -1 });

    if (!game) {
      return res.status(400).json({ error: 'No active game found' });
    }

    // Check if prediction phase is still open
    if (game.predictionEndTime && new Date() > game.predictionEndTime) {
      return res.status(400).json({ error: 'Prediction phase has ended' });
    }

    // Filter out cars with null carId (deleted cars)
    const validCars = game.cars.filter((car) => car.carId && car.carId._id);
    if (validCars.length === 0) {
      return res.status(400).json({ error: 'Game has no valid cars' });
    }

    // Verify car is in this game
    const carInGame = validCars.find(
      (c) => c.carId && c.carId._id && c.carId._id.toString() === carId
    );
    if (!carInGame) {
      return res.status(400).json({ error: 'Invalid car selection' });
    }

    const userId = req.user._id || req.user.sub;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (action === 'add') {
      // Check user balance
      if (user.wallet?.partyCoins < 100) {
        return res.status(400).json({ error: 'Insufficient coins. Need 100 coins per selection.' });
      }

      // Check if user has existing predictions for this game
      const existingPredictions = await Prediction.find({
        gameId: game._id,
        userId: userId,
      });

      // If user has existing predictions, they can only add to the same car
      if (existingPredictions.length > 0) {
        const firstCarId = existingPredictions[0].predictedCarId.toString();
        const requestedCarId = carId.toString();
        
        // If trying to select a different car, reject
        if (firstCarId !== requestedCarId) {
          const existingCar = await Car.findById(firstCarId);
          return res.status(400).json({ 
            error: `You can only select one car per game. You have already selected ${existingCar?.name || 'a car'}. You can add more selections to that car or remove all selections to choose a different car.` 
          });
        }
      }

      // Deduct coins
      user.wallet.partyCoins -= 100;
      await user.save();

      // Create prediction (allow multiple per user per car, but only one car per user)
      const prediction = await Prediction.create({
        gameId: game._id,
        userId: userId,
        predictedCarId: carId,
        betAmount: 100,
        partyId: partyId || null,
      });

      // Update game pot
      game.totalPot = (game.totalPot || 0) + 100;
      game.totalPredictions = (game.totalPredictions || 0) + 1;
      await game.save();

      res.json({
        message: 'Selection added successfully',
        prediction,
      });
    } else if (action === 'remove') {
      // Find the most recent prediction for this car by this user
      const predictionToRemove = await Prediction.findOne({
        gameId: game._id,
        userId: userId,
        predictedCarId: carId,
      }).sort({ timestamp: -1 });

      if (!predictionToRemove) {
        return res.status(400).json({ error: 'No selection found to remove' });
      }

      // Refund coins
      user.wallet.partyCoins += 100;
      await user.save();

      // Delete prediction
      await Prediction.findByIdAndDelete(predictionToRemove._id);

      // Update game pot
      game.totalPot = Math.max(0, (game.totalPot || 0) - 100);
      game.totalPredictions = Math.max(0, (game.totalPredictions || 0) - 1);
      await game.save();

      res.json({
        message: 'Selection removed successfully',
      });
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "add" or "remove"' });
    }
  } catch (error) {
    console.error('[Games Routes] Error in predict:', error);
    // Handle duplicate key error gracefully
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Duplicate selection. Please try again.' });
    }
    next(error);
  }
});

// Get game history
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const games = await Game.find({ status: 'finished' })
      .populate('cars.carId')
      .populate('winnerCarId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get user's predictions for these games
    const userId = req.user._id || req.user.sub;
    const gameIds = games.map((g) => g._id);
    const predictions = await Prediction.find({
      gameId: { $in: gameIds },
      userId: userId,
    });

    const predictionsMap = {};
    predictions.forEach((p) => {
      predictionsMap[p.gameId.toString()] = p;
    });

    const gamesWithPredictions = games.map((game) => {
      const gameObj = game.toObject();
      // Filter out cars with null carId (deleted cars)
      if (gameObj.cars) {
        gameObj.cars = gameObj.cars.filter((car) => car.carId && car.carId._id);
      }
      return {
        ...gameObj,
      userPrediction: predictionsMap[game._id.toString()] || null,
      };
    });

    res.json({ games: gamesWithPredictions });
  } catch (error) {
    next(error);
  }
});

// Get user stats
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.sub;
    const predictions = await Prediction.find({ userId: userId })
      .populate('gameId')
      .populate('predictedCarId');

    const totalGames = predictions.length;
    const wins = predictions.filter((p) => p.isCorrect === true).length;
    const losses = predictions.filter((p) => p.isCorrect === false).length;
    const totalWagered = predictions.length * 100;
    const totalWon = predictions
      .filter((p) => p.isCorrect === true)
      .reduce((sum, p) => sum + (p.payout || 0), 0);
    const netProfit = totalWon - totalWagered;

    res.json({
      totalGames,
      wins,
      losses,
      winRate: totalGames > 0 ? ((wins / totalGames) * 100).toFixed(2) : 0,
      totalWagered,
      totalWon,
      netProfit,
    });
  } catch (error) {
    next(error);
  }
});

// Admin routes
router.get('/admin/cars', authenticate, isAdmin, async (req, res, next) => {
  try {
    const cars = await Car.find().populate('createdBy', 'account.displayName').sort({ createdAt: -1 });
    res.json({ cars });
  } catch (error) {
    next(error);
  }
});

router.post('/admin/cars', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { name, topViewImage, sideViewImage, speedRegular, speedDesert, speedMuddy, isActive } = req.body;

    if (!name || !topViewImage || !sideViewImage || !speedRegular || !speedDesert || !speedMuddy) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const car = await Car.create({
      name,
      topViewImage,
      sideViewImage,
      speedRegular: parseInt(speedRegular),
      speedDesert: parseInt(speedDesert),
      speedMuddy: parseInt(speedMuddy),
      isActive: isActive !== false,
      createdBy: req.user._id || req.user.sub,
    });

    res.json({ message: 'Car created successfully', car });
  } catch (error) {
    next(error);
  }
});

router.put('/admin/cars/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { name, topViewImage, sideViewImage, speedRegular, speedDesert, speedMuddy, isActive } = req.body;

    const car = await Car.findByIdAndUpdate(
      req.params.id,
      {
        name,
        topViewImage,
        sideViewImage,
        speedRegular: speedRegular ? parseInt(speedRegular) : undefined,
        speedDesert: speedDesert ? parseInt(speedDesert) : undefined,
        speedMuddy: speedMuddy ? parseInt(speedMuddy) : undefined,
        isActive,
      },
      { new: true, runValidators: true }
    );

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    res.json({ message: 'Car updated successfully', car });
  } catch (error) {
    next(error);
  }
});

router.delete('/admin/cars/:id', authenticate, isAdmin, async (req, res, next) => {
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

router.get('/admin/games', authenticate, isAdmin, async (req, res, next) => {
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

    res.json({ games: gamesWithValidCars, total, page, limit });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

