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

        // If game is in racing state, check if animation is running
        if (activeGame.status === 'racing' && activeGame.raceStartTime) {
          const raceStartTime = new Date(activeGame.raceStartTime);
          const now = new Date();
          const raceDuration = (now - raceStartTime) / 1000; // seconds
          
          // If race animation isn't running and race just started (< 5 seconds), restart it
          if (!this.raceAnimationInterval && raceDuration < 5 && activeGame.results && activeGame.results.length > 0) {
            console.log('[Game Engine] Race animation not running, restarting for game', activeGame.gameNumber);
            await activeGame.populate('cars.carId');
            this.animateRace(activeGame, activeGame.results);
            return;
          }
          
          // If game is stuck in racing state for more than 15 seconds, finish it (races should finish in 3-10s)
          if (raceDuration > 15) {
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
    // Prevent multiple games from being generated simultaneously
    if (this.currentGame) {
      console.log('[Game Engine] Game generation already in progress, skipping...');
      return;
    }

    try {
      // Check if there's already an active game
      const existingGame = await Game.findOne({
        status: { $in: ['waiting', 'predictions', 'racing'] },
      });
      if (existingGame) {
        // If game is stuck in racing status for more than 15 seconds, finish it first (races should finish in 3-10s)
        if (existingGame.status === 'racing' && existingGame.raceStartTime) {
          const raceStartTime = new Date(existingGame.raceStartTime);
          const now = new Date();
          const raceDuration = (now - raceStartTime) / 1000; // seconds
          
          if (raceDuration > 15) {
            console.log(`[Game Engine] Found stuck race (${raceDuration.toFixed(1)}s), finishing it before generating new game...`);
            await this.finishRace(existingGame._id);
            // Wait a moment for the finish to complete, then continue
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.log('[Game Engine] Active game already exists and is racing, skipping generation');
            return;
          }
        } else if (existingGame.status !== 'finished') {
          console.log(`[Game Engine] Active game already exists (status: ${existingGame.status}), skipping generation`);
          return;
        }
      }

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
      if (!game) {
        console.log(`[Game Engine] Game ${gameId} not found, cannot start race`);
        return;
      }
      
      if (game.status === 'finished') {
        console.log(`[Game Engine] Game ${game.gameNumber} already finished, cannot start race`);
        return;
      }

      // Clear any existing race animation interval
      if (this.raceAnimationInterval) {
        clearInterval(this.raceAnimationInterval);
        this.raceAnimationInterval = null;
      }

      game.status = 'racing';
      game.raceStartTime = new Date();
      await game.save();

      // Calculate race results
      const results = this.calculateRaceResults(game);
      if (!results || results.length === 0) {
        console.error(`[Game Engine] No race results calculated for game ${game.gameNumber}`);
        return;
      }

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

      console.log(`[Game Engine] Race started for game ${game.gameNumber}, starting animation...`);

      // Animate race progress
      this.animateRace(game, results);
    } catch (error) {
      console.error('[Game Engine] Error starting race:', error);
      console.error(error.stack);
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
    // Animation duration: cars finish in 1/3 of their actual time, so animation is shorter
    // If maxTime is ~10 seconds, animation should be ~3-4 seconds
    const animationDuration = Math.max(3000, Math.min(10000, (maxTime / 3) * 1000)); // 3-10 seconds
    const updateInterval = 33; // Update every 33ms (~30fps for smooth movement)
    const totalUpdates = Math.ceil(animationDuration / updateInterval);
    let currentUpdate = 0;
    let raceFinished = false;

    console.log(`[Game Engine] Starting race animation for game ${game.gameNumber}, duration: ${animationDuration}ms, maxTime: ${maxTime}s, totalUpdates: ${totalUpdates}`);

    // Send initial progress (cars at start line)
    const initialPositions = {};
    results.forEach((result) => {
      const carIdStr = result.carId.toString();
      initialPositions[carIdStr] = {
        distance: 0,
        progress: 0,
        segment: 0,
      };
    });
    this.io.emit('game:race_progress', {
      gameId: game._id.toString(),
      carPositions: initialPositions,
      progress: 0,
    });
    console.log(`[Game Engine] Sent initial race progress for game ${game.gameNumber}`);

    this.raceAnimationInterval = setInterval(() => {
      if (raceFinished) {
        clearInterval(this.raceAnimationInterval);
        this.raceAnimationInterval = null;
        return;
      }

      currentUpdate++;
      const progress = Math.min(currentUpdate / totalUpdates, 1);
      // Scale elapsedTime by 3 to make cars move 3x faster through the track
      // Progress goes 0-1 over animationDuration, but cars should finish in 1/3 of maxTime
      // Cap at maxTime to prevent going beyond actual race completion
      const elapsedTime = Math.min(progress * maxTime * 3, maxTime);

      const carPositions = {};
      let winnerReached = false;
      
      // Calculate positions for all cars
      for (const result of results) {
        let distance = 0;
        let segmentProgress = 0;
        let currentSegment = 0;

        for (let i = 0; i < result.segmentTimes.length; i++) {
          // Use original segmentTime, but elapsedTime is already scaled by 3x
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
        const finalDistance = Math.min(distance, 300); // Cap at 300m
        const finalProgress = Math.min((finalDistance / 300) * 100, 100);
        
        carPositions[carIdStr] = {
          distance: finalDistance,
          progress: finalProgress,
          segment: currentSegment,
        };

        // Check if any car reached finish line (100% progress) - declare winner immediately
        if (finalProgress >= 100 && !winnerReached) {
          winnerReached = true;
        }
      }

      // Emit progress update (always emit, even if winner reached)
      if (currentUpdate % 10 === 0 || winnerReached) {
        // Log every 10th update to avoid spam
        console.log(`[Game Engine] Race progress update ${currentUpdate}/${totalUpdates} for game ${game.gameNumber}, progress: ${(progress * 100).toFixed(1)}%`);
      }
      this.io.emit('game:race_progress', {
        gameId: game._id.toString(),
        carPositions,
        progress: progress * 100,
      });

      // Finish race immediately when any car reaches finish line
      // But ensure at least 10 updates have been sent for smooth animation
      if (winnerReached && !raceFinished && currentUpdate >= 10) {
        raceFinished = true;
        clearInterval(this.raceAnimationInterval);
        // Send final progress update with all cars at finish
        const finalPositions = {};
        results.forEach((result) => {
          const carIdStr = result.carId.toString();
          finalPositions[carIdStr] = {
            distance: 300,
            progress: 100,
            segment: 3,
          };
        });
        this.io.emit('game:race_progress', {
          gameId: game._id.toString(),
          carPositions: finalPositions,
          progress: 100,
        });
        this.finishRace(game._id);
        return; // Exit interval callback
      }

      // Finish race if animation completed (fallback, but winner should finish first)
      if (currentUpdate >= totalUpdates && !raceFinished) {
        raceFinished = true;
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

      // Start next game immediately (minimal gap - 500ms for event processing)
      // Only start next game if clients are still connected
      console.log('[Game Engine] Starting next game in 500ms...');
      if (this.connectedClients.size > 0) {
        // Minimal delay to ensure race finish event is processed, then start new game
        setTimeout(() => {
          if (this.connectedClients.size > 0) {
            // Directly generate new game instead of going through runGameCycle check
            this.generateNewGame();
          } else {
            console.log('[Game Engine] No clients connected, waiting for clients before starting next game...');
            this.isWaitingForClients = true;
          }
        }, 500); // 500ms delay to ensure race finish is broadcast
      } else {
        console.log('[Game Engine] No clients connected, waiting for clients before starting next game...');
        this.isWaitingForClients = true;
      }
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

