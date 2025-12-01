const crypto = require('crypto');
const Car = require('../schemas/car');
const Game = require('../schemas/game');
const Prediction = require('../schemas/prediction');
const User = require('../schemas/users');

class GameEngine {
  constructor(io) {
    this.io = io;
    this.gameInterval = null;
    this.currentGame = null;
    this.raceAnimationInterval = null;
    this.connectedClients = new Set(); // Track connected clients
    this.isWaitingForClients = false; // Flag to indicate waiting state
  }

  // Track client connection
  addClient(socketId) {
    this.connectedClients.add(socketId);
    console.log(`[Game Engine] Client connected. Total clients: ${this.connectedClients.size}`);
    
    // If we were waiting for clients and now have at least one, start a game
    if (this.isWaitingForClients && this.connectedClients.size > 0) {
      this.isWaitingForClients = false;
      console.log('[Game Engine] Client connected, starting game cycle...');
      this.runGameCycle();
    }
  }

  // Track client disconnection
  removeClient(socketId) {
    this.connectedClients.delete(socketId);
    console.log(`[Game Engine] Client disconnected. Total clients: ${this.connectedClients.size}`);
    
    // If no clients left, stop the game loop and wait
    if (this.connectedClients.size === 0) {
      console.log('[Game Engine] No clients connected. Waiting for clients before starting next game...');
      this.isWaitingForClients = true;
      if (this.gameInterval) {
        clearInterval(this.gameInterval);
        this.gameInterval = null;
      }
    }
  }

  // Get number of connected clients
  getClientCount() {
    return this.connectedClients.size;
  }

  // Start the game loop (only runs when clients are connected)
  start() {
    console.log('[Game Engine] Game engine initialized');
    // Don't start immediately - wait for first client
    this.isWaitingForClients = true;
  }

  // Stop the game loop
  stop() {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
    if (this.raceAnimationInterval) {
      clearInterval(this.raceAnimationInterval);
      this.raceAnimationInterval = null;
    }
    this.connectedClients.clear();
    this.isWaitingForClients = true;
  }

  // Main game cycle
  async runGameCycle() {
    // Don't run if no clients are connected
    if (this.connectedClients.size === 0) {
      console.log('[Game Engine] No clients connected, skipping game cycle');
      this.isWaitingForClients = true;
      return;
    }

    try {
      // Check if MongoDB is connected
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        console.log('[Game Engine] MongoDB not connected, skipping game cycle');
        return;
      }

      // Check if there's an active game
      const activeGame = await Game.findOne({
        status: { $in: ['waiting', 'predictions', 'racing'] },
      });

      if (activeGame) {
        console.log('[Game Engine] Active game exists:', activeGame.gameNumber, 'Status:', activeGame.status);
        
        // Skip games that are already finished
        if (activeGame.status === 'finished') {
          console.log('[Game Engine] Active game is already finished, generating new game...');
          // Generate new game immediately if old one is finished
          if (this.connectedClients.size > 0) {
            await this.generateNewGame();
          }
          return;
        }

        // If game is stuck in racing state for more than 30 seconds, finish it
        if (activeGame.status === 'racing' && activeGame.raceStartTime) {
          const raceStartTime = new Date(activeGame.raceStartTime);
          const now = new Date();
          const raceDuration = (now - raceStartTime) / 1000; // seconds
          
          if (raceDuration > 30) {
            console.log('[Game Engine] Race stuck for', raceDuration, 'seconds, finishing it...');
            await this.finishRace(activeGame._id);
            // After finishing, generate new game (only if clients are still connected)
            if (this.connectedClients.size > 0) {
              await this.generateNewGame();
            }
            return;
          }
        }
        
        // If game is in predictions but predictionEndTime has passed, lock predictions
        if (activeGame.status === 'predictions' && activeGame.predictionEndTime) {
          const endTime = new Date(activeGame.predictionEndTime);
          const now = new Date();
          if (now > endTime) {
            console.log('[Game Engine] Prediction time expired, locking predictions...');
            await this.lockPredictions(activeGame._id);
            setTimeout(() => {
              if (this.connectedClients.size > 0) {
                this.startRace(activeGame._id);
              }
            }, 1000);
            return;
          }
        }
        
        // Start interval for next game cycle (only if clients are connected)
        if (this.connectedClients.size > 0 && !this.gameInterval) {
          this.gameInterval = setInterval(() => {
            this.runGameCycle();
          }, 180000); // Run every 3 minutes
        }
        
        return;
      }

      // Generate new game (only if clients are connected)
      if (this.connectedClients.size > 0) {
        await this.generateNewGame();
        
        // Start interval for next game cycle
        if (!this.gameInterval) {
          this.gameInterval = setInterval(() => {
            this.runGameCycle();
          }, 180000); // Run every 3 minutes
        }
      }
    } catch (error) {
      // Only log if it's not a connection error
      if (error.name !== 'MongoNotConnectedError' && error.name !== 'MongoServerError') {
        console.error('[Game Engine] Error in game cycle:', error);
      } else {
        console.log('[Game Engine] MongoDB connection issue, will retry when connected');
      }
    }
  }

  // Generate a new game
  async generateNewGame() {
    try {
      // Get active cars
      const activeCars = await Car.find({ isActive: true });
      if (activeCars.length < 3) {
        console.log('[Game Engine] Not enough active cars (need 3)');
        return;
      }

      // Select 3 random cars
      const selectedCars = this.shuffleArray([...activeCars]).slice(0, 3);

      // Generate next game number
      const lastGame = await Game.findOne().sort({ gameNumber: -1 });
      const gameNumber = lastGame ? lastGame.gameNumber + 1 : 1;

      // Generate 3 tracks with random terrain segments
      const tracks = [];
      for (let i = 0; i < 3; i++) {
        const segments = this.generateRandomTrack();
        tracks.push({ segments });
      }

      // Create game
      const startTime = new Date();
      const predictionEndTime = new Date(startTime.getTime() + 30000); // 30 seconds

      const game = await Game.create({
        gameNumber,
        status: 'predictions',
        cars: selectedCars.map((car, index) => ({
          carId: car._id,
          trackNumber: index + 1,
        })),
        tracks,
        startTime,
        predictionEndTime,
        totalPot: 0,
        totalPredictions: 0,
      });

      this.currentGame = game;

      // Populate and broadcast
      await game.populate('cars.carId');
      this.io.emit('game:started', {
        game: {
          _id: game._id,
          gameNumber: game.gameNumber,
          cars: game.cars,
          tracks: game.tracks.map((track) => ({
            segments: track.segments.map((seg, idx) =>
              idx === 0 ? seg : 'hidden'
            ), // Only show first segment
          })),
          startTime: game.startTime,
          predictionEndTime: game.predictionEndTime,
        },
      });

      console.log(`[Game Engine] Game ${gameNumber} started`);

      // Schedule prediction lock (30 seconds) - only if clients are still connected
      setTimeout(() => {
        if (this.connectedClients.size > 0) {
          this.lockPredictions(game._id);
        }
      }, 30000);

      // Schedule race start (35 seconds = 30s predictions + 5s delay) - only if clients are still connected
      setTimeout(() => {
        if (this.connectedClients.size > 0) {
          this.startRace(game._id);
        }
      }, 35000); // Start race 5 seconds after predictions lock
    } catch (error) {
      console.error('[Game Engine] Error generating game:', error);
    }
  }

  // Generate random track (3 segments)
  generateRandomTrack() {
    const terrains = ['regular', 'desert', 'muddy'];
    // Ensure variety - not all same terrain
    const segments = [];
    while (segments.length < 3) {
      const terrain = terrains[crypto.randomInt(0, terrains.length)];
      if (!segments.includes(terrain) || segments.length >= 2) {
        segments.push(terrain);
      }
    }
    return segments;
  }

  // Shuffle array (Fisher-Yates)
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Lock predictions
  async lockPredictions(gameId) {
    try {
      const game = await Game.findById(gameId);
      if (!game || game.status !== 'predictions') {
        return;
      }

      // Get final prediction counts
      const predictions = await Prediction.find({ gameId });
      const counts = {};
      game.cars.forEach((car) => {
        counts[car.carId.toString()] = predictions.filter(
          (p) => p.predictedCarId.toString() === car.carId.toString()
        ).length;
      });

      this.io.emit('game:predictions_locked', {
        gameId: game._id,
        finalCounts: counts,
        totalPredictions: predictions.length,
        totalPot: game.totalPot,
      });

      console.log(`[Game Engine] Predictions locked for game ${game.gameNumber}`);
    } catch (error) {
      console.error('[Game Engine] Error locking predictions:', error);
    }
  }

  // Start race
  async startRace(gameId) {
    try {
      const game = await Game.findById(gameId).populate('cars.carId');
      if (!game || game.status === 'finished') {
        return;
      }

      game.status = 'racing';
      game.raceStartTime = new Date();
      await game.save();

      // Calculate race results
      const results = this.calculateRaceResults(game);
      game.results = results;
      game.winnerCarId = results[0].carId; // First place is winner
      await game.save();

      // Broadcast race start with full track info
      const raceResults = results.map((r) => ({
        carId: r.carId.toString(),
        totalTime: r.totalTime,
        position: r.position,
        segmentTimes: r.segmentTimes,
      }));
      
      this.io.emit('game:race_start', {
        gameId: game._id.toString(),
        tracks: game.tracks,
        results: raceResults,
      });

      console.log(`[Game Engine] Race started for game ${game.gameNumber}`);

      // Animate race progress
      this.animateRace(game, results);
    } catch (error) {
      console.error('[Game Engine] Error starting race:', error);
    }
  }

  // Calculate race results
  calculateRaceResults(game) {
    const results = [];

    game.cars.forEach((carAssignment, trackIndex) => {
      const car = carAssignment.carId;
      const track = game.tracks[trackIndex];
      let totalTime = 0;
      const segmentTimes = [];

      track.segments.forEach((terrain) => {
        // Get speed for terrain
        let speedKmh;
        if (terrain === 'regular') {
          speedKmh = car.speedRegular;
        } else if (terrain === 'desert') {
          speedKmh = car.speedDesert;
        } else {
          speedKmh = car.speedMuddy;
        }

        // Convert km/h to m/s
        const speedMps = speedKmh / 3.6;
        // Calculate time for 100m segment
        const time = 100 / speedMps;
        segmentTimes.push(time);
        totalTime += time;
      });

      results.push({
        carId: car._id,
        trackNumber: trackIndex + 1,
        totalTime: parseFloat(totalTime.toFixed(2)),
        segmentTimes: segmentTimes.map((t) => parseFloat(t.toFixed(2))),
      });
    });

    // Sort by time (ascending - fastest first)
    results.sort((a, b) => a.totalTime - b.totalTime);

    // Add position
    results.forEach((result, index) => {
      result.position = index + 1;
    });

    return results;
  }

  // Animate race progress
  animateRace(game, results) {
    const maxTime = Math.max(...results.map((r) => r.totalTime));
    const animationDuration = 30000; // 30 seconds
    const updateInterval = 33; // Update every 33ms (~30fps for smooth movement)
    const totalUpdates = animationDuration / updateInterval;
    let currentUpdate = 0;

    this.raceAnimationInterval = setInterval(() => {
      currentUpdate++;
      const progress = currentUpdate / totalUpdates;
      const elapsedTime = progress * maxTime;

      const carPositions = {};
      results.forEach((result) => {
        let distance = 0;
        let segmentProgress = 0;
        let currentSegment = 0;

        for (let i = 0; i < result.segmentTimes.length; i++) {
          const segmentTime = result.segmentTimes[i];
          if (elapsedTime >= segmentProgress + segmentTime) {
            distance += 100; // Completed segment
            segmentProgress += segmentTime;
            currentSegment = i + 1;
          } else {
            // In current segment
            const timeInSegment = elapsedTime - segmentProgress;
            const speed = 100 / segmentTime; // m per second
            distance += speed * timeInSegment;
            break;
          }
        }

        const carIdStr = result.carId.toString();
        carPositions[carIdStr] = {
          distance: Math.min(distance, 300), // Cap at 300m
          progress: Math.min((distance / 300) * 100, 100),
          segment: currentSegment,
        };
      });

      this.io.emit('game:race_progress', {
        gameId: game._id.toString(),
        carPositions,
        progress: progress * 100,
      });

      if (currentUpdate >= totalUpdates) {
        clearInterval(this.raceAnimationInterval);
        this.finishRace(game._id);
      }
    }, updateInterval);
  }

  // Finish race and distribute payouts
  async finishRace(gameId) {
    try {
      const game = await Game.findById(gameId)
        .populate('cars.carId')
        .populate('winnerCarId');
      if (!game) {
        return;
      }

      // Guard: Don't finish a game that's already finished
      if (game.status === 'finished') {
        console.log(`[Game Engine] Game ${game.gameNumber} is already finished, skipping...`);
        return;
      }

      const predictions = await Prediction.find({ gameId: game._id });
      const totalPot = predictions.length * 100;
      const platformFee = totalPot * 0.05;

      game.totalPot = totalPot;
      game.platformFee = platformFee;

      // Get all winning selections (not users, but individual selections)
      // Handle both ObjectId and populated object cases
      const winnerCarIdStr = game.winnerCarId?._id?.toString() || game.winnerCarId?.toString();
      if (!winnerCarIdStr) {
        console.error('[Game Engine] No winner car ID found');
        return;
      }

      const winningSelections = predictions.filter((p) => {
        const predCarId = p.predictedCarId?._id?.toString() || p.predictedCarId?.toString();
        return predCarId && predCarId === winnerCarIdStr;
      });

      let totalWinnerPayout = 0;
      let payoutPerSelection = 0;

      // Calculate payouts: divide winner pool by number of winning selections
      if (winningSelections.length > 0) {
        const payoutPool = totalPot - platformFee; // Total pot minus 5% platform fee
        payoutPerSelection = payoutPool / winningSelections.length; // Divide equally among all winning selections
        totalWinnerPayout = payoutPool;

        game.winnerPayout = totalWinnerPayout;

        // Group winning selections by user to calculate total payout per user
        const userPayouts = {};
        winningSelections.forEach((selection) => {
          const userIdStr = selection.userId.toString();
          if (!userPayouts[userIdStr]) {
            userPayouts[userIdStr] = 0;
          }
          userPayouts[userIdStr] += payoutPerSelection;
        });

        // Distribute payouts to users (sum of all their winning selections)
        for (const [userIdStr, totalPayout] of Object.entries(userPayouts)) {
          await User.findByIdAndUpdate(userIdStr, {
            $inc: { 'wallet.partyCoins': totalPayout },
          });
        }

        // Update each winning selection with payout
        for (const selection of winningSelections) {
          selection.isCorrect = true;
          selection.payout = parseFloat(payoutPerSelection.toFixed(2));
          await selection.save();
        }
      } else {
        // No winners: nobody gets anything, but losers still lose
        game.winnerPayout = 0;
      }

      // Mark losers (they already lost 100 coins when betting)
      const losers = predictions.filter((p) => {
        const predCarId = p.predictedCarId?._id?.toString() || p.predictedCarId?.toString();
        return !predCarId || predCarId !== winnerCarIdStr;
      });

      for (const loser of losers) {
        loser.isCorrect = false;
        loser.payout = 0;
        await loser.save();
      }

      game.status = 'finished';
      game.raceEndTime = new Date();
      await game.save();

      // Broadcast results
      const winnerCar = game.winnerCarId;
      this.io.emit('game:finished', {
        game: {
          _id: game._id.toString(),
          gameNumber: game.gameNumber,
          winnerCarId: winnerCar._id.toString(),
          winnerName: winnerCar.name,
          results: game.results.map((r) => ({
            carId: r.carId.toString(),
            totalTime: r.totalTime,
            position: r.position,
            segmentTimes: r.segmentTimes,
          })),
          totalPot,
          platformFee,
          winnerPayout: totalWinnerPayout,
          totalPredictions: predictions.length,
          winningSelectionsCount: winningSelections.length,
          payoutPerSelection: winningSelections.length > 0 ? parseFloat(payoutPerSelection.toFixed(2)) : 0,
        },
      });

      console.log(`[Game Engine] Race finished for game ${game.gameNumber}`);
      console.log(`[Game Engine] Winning selections: ${winningSelections.length}, Payout per selection: ${winningSelections.length > 0 ? payoutPerSelection.toFixed(2) : 0}`);

      this.currentGame = null;

      // Wait 30 seconds before starting next game (to show results: 10s winner + 10s user result + 10s countdown)
      // Only start next game if clients are still connected
      console.log('[Game Engine] Waiting 30 seconds before starting next game (results display)...');
      setTimeout(() => {
        if (this.connectedClients.size > 0) {
          this.runGameCycle();
        } else {
          console.log('[Game Engine] No clients connected, waiting for clients before starting next game...');
          this.isWaitingForClients = true;
        }
      }, 30000);
    } catch (error) {
      // Only log if it's not a connection error
      if (error.name !== 'MongoNotConnectedError' && error.name !== 'MongoServerError') {
        console.error('[Game Engine] Error finishing race:', error);
      } else {
        console.log('[Game Engine] MongoDB connection issue during race finish, will retry when connected');
      }
      this.currentGame = null;
      // Only retry if clients are connected
      if (this.connectedClients.size > 0) {
        this.runGameCycle();
      } else {
        this.isWaitingForClients = true;
      }
    }
  }

  // Get prediction counts for a game
  async getPredictionCounts(gameId) {
    const predictions = await Prediction.find({ gameId });
    const game = await Game.findById(gameId);
    const counts = {};

    game.cars.forEach((car) => {
      counts[car.carId.toString()] = predictions.filter(
        (p) => p.predictedCarId.toString() === car.carId.toString()
      ).length;
    });

    return counts;
  }
}

module.exports = GameEngine;

