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
        
        // Skip games that are already finished (results phase should be max 8 seconds)
        if (activeGame.status === 'finished') {
          const finishedTime = activeGame.raceEndTime ? new Date(activeGame.raceEndTime) : new Date(activeGame.updatedAt);
          const now = new Date();
          const timeSinceFinished = (now - finishedTime) / 1000; // seconds
          
          // If finished more than 8 seconds ago (results phase duration), start new game
          if (timeSinceFinished > 8) {
            console.log(`[Game Engine] Finished game ${activeGame.gameNumber} completed results phase (${timeSinceFinished.toFixed(1)}s ago), generating new game...`);
            if (this.connectedClients.size > 0) {
              await this.generateNewGame();
            }
            return;
          } else {
            // Still in results phase, wait for it to complete
            console.log(`[Game Engine] Finished game ${activeGame.gameNumber} still in results phase (${timeSinceFinished.toFixed(1)}s / 8s)`);
            return;
          }
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
          
          // If game is stuck in racing state for more than 12 seconds, finish it (races should finish in exactly 10s)
          if (raceDuration > 12) {
            console.log('[Game Engine] Race stuck for', raceDuration, 'seconds, finishing it...');
            await this.finishRace(activeGame._id);
            // After finishing, generate new game (only if clients are still connected)
            if (this.connectedClients.size > 0) {
              await this.generateNewGame();
            }
            return;
          }
        }
        
        // If game is in predictions, check if it should be locked
        if (activeGame.status === 'predictions') {
          const now = new Date();
          let shouldLock = false;
          let timeSinceEnd = 0;
          
          if (activeGame.predictionEndTime) {
            const endTime = new Date(activeGame.predictionEndTime);
            timeSinceEnd = (now - endTime) / 1000; // seconds
            if (timeSinceEnd > 0) {
              shouldLock = true;
            }
          } else if (activeGame.startTime) {
            // Fallback: if no predictionEndTime, check if game has been in predictions for more than 15 seconds
            const startTime = new Date(activeGame.startTime);
            const timeSinceStart = (now - startTime) / 1000;
            if (timeSinceStart > 15) {
              console.log(`[Game Engine] Game ${activeGame.gameNumber} stuck in predictions for ${timeSinceStart.toFixed(1)}s (no predictionEndTime), forcing lock...`);
              shouldLock = true;
              timeSinceEnd = timeSinceStart - 15; // Assume it expired timeSinceStart - 15 seconds ago
            }
          }
          
          if (shouldLock) {
            console.log(`[Game Engine] Prediction time expired (${timeSinceEnd.toFixed(1)}s ago), locking predictions...`);
            await this.lockPredictions(activeGame._id);
            
            // If predictions were locked more than 5 seconds ago, start race immediately
            if (timeSinceEnd > 5) {
              console.log('[Game Engine] Countdown phase expired, starting race immediately...');
              if (this.connectedClients.size > 0) {
                this.startRace(activeGame._id);
              }
            } else {
              // Schedule race start after remaining countdown time
              const remainingCountdown = 5000 - (timeSinceEnd * 1000);
              setTimeout(() => {
                if (this.connectedClients.size > 0) {
                  this.startRace(activeGame._id);
                }
              }, Math.max(0, remainingCountdown));
            }
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

      // Create game with fixed timing: 15s predictions + 5s countdown + 10s race = 30s total
      const startTime = new Date();
      const predictionEndTime = new Date(startTime.getTime() + 15000); // 15 seconds for predictions

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
        phaseStartTimes: {
          predictions: startTime,
        },
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

      console.log(`[Game Engine] Game ${gameNumber} started - Phase: predictions (15s)`);

      // Schedule prediction lock (15 seconds) - only if clients are still connected
      const predictionLockTimeout = setTimeout(() => {
        if (this.connectedClients.size > 0) {
          this.lockPredictions(game._id);
        }
      }, 15000);

      // Store timeout for cleanup if needed
      game.predictionLockTimeout = predictionLockTimeout;
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

      // Record phase end time
      const predictionsEndTime = new Date();
      if (!game.phaseStartTimes) game.phaseStartTimes = {};
      if (!game.phaseEndTimes) game.phaseEndTimes = {};
      game.phaseEndTimes.predictions = predictionsEndTime;
      game.phaseStartTimes.countdown = predictionsEndTime;
      await game.save();

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

      console.log(`[Game Engine] Predictions locked for game ${game.gameNumber} - Phase: countdown (5s)`);

      // Schedule race start after 5 second countdown - only if clients are still connected
      const raceStartTimeout = setTimeout(() => {
        if (this.connectedClients.size > 0) {
          this.startRace(gameId);
        }
      }, 5000); // 5 seconds countdown

      // Store timeout for cleanup
      game.raceStartTimeout = raceStartTimeout;
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

      // Record phase times
      const countdownEndTime = new Date();
      const raceStartTime = new Date();
      if (!game.phaseStartTimes) game.phaseStartTimes = {};
      if (!game.phaseEndTimes) game.phaseEndTimes = {};
      game.phaseEndTimes.countdown = countdownEndTime;
      game.phaseStartTimes.racing = raceStartTime;

      game.status = 'racing';
      game.raceStartTime = raceStartTime;
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

  // Animate race progress - Dynamic duration based on actual speeds (~10 seconds target)
  animateRace(game, results) {
    // Find fastest car (lowest totalTime)
    const fastestTime = Math.min(...results.map((r) => r.totalTime));
    
    // Dynamic animation duration: target ~10 seconds, but scale based on actual speeds
    // If fastest car takes 8s, animation = 10s (normal speed)
    // If fastest car takes 20s (all slow), animation = 20s (slower race)
    // Clamp between 8s (very fast) and 15s (very slow) for reasonable viewing
    const baseDuration = 10000; // 10 seconds base
    const animationDuration = Math.max(8000, Math.min(15000, fastestTime * 1000));
    const updateInterval = 12; // Update every 12ms (~83fps for smooth movement)
    const totalUpdates = Math.ceil(animationDuration / updateInterval);
    let currentUpdate = 0;
    let raceFinished = false;
    let winnerReached = false;

    console.log(`[Game Engine] Starting race animation for game ${game.gameNumber} - Duration: ${(animationDuration/1000).toFixed(1)}s, fastestTime: ${fastestTime.toFixed(2)}s`);

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

    // Safety: Maximum updates to prevent infinite loops (2x expected duration)
    const maxUpdates = totalUpdates * 2;
    
    this.raceAnimationInterval = setInterval(() => {
      if (raceFinished) {
        clearInterval(this.raceAnimationInterval);
        this.raceAnimationInterval = null;
        return;
      }

      currentUpdate++;
      
      // Safety check: Stop if we've exceeded maximum updates
      if (currentUpdate >= maxUpdates) {
        console.log(`[Game Engine] Safety stop: Exceeded max updates (${maxUpdates}) for game ${game.gameNumber}, forcing finish`);
        raceFinished = true;
        clearInterval(this.raceAnimationInterval);
        this.raceAnimationInterval = null;
        
        // Calculate final positions one more time
        const progress = 1;
        const animationTime = progress * (animationDuration / 1000);
        const timeScale = fastestTime / (animationDuration / 1000);
        const scaledAnimationTime = animationTime * timeScale;
        
        const finalCarPositions = {};
        let maxProgress = 0;
        let leadingCarId = null;
        
        for (const result of results) {
          const elapsedTime = scaledAnimationTime;
          let distance = 0;
          let segmentProgress = 0;
          
          for (let i = 0; i < result.segmentTimes.length; i++) {
            const segmentTime = result.segmentTimes[i];
            if (elapsedTime >= segmentProgress + segmentTime) {
              distance += 100;
              segmentProgress += segmentTime;
            } else {
              const timeInSegment = elapsedTime - segmentProgress;
              const speed = 100 / segmentTime;
              distance += speed * timeInSegment;
              break;
            }
          }
          
          const carIdStr = result.carId.toString();
          const finalDistance = Math.min(distance, 300);
          const finalProgress = Math.min((finalDistance / 300) * 100, 100);
          
          finalCarPositions[carIdStr] = {
            distance: finalDistance,
            progress: finalProgress,
            segment: Math.floor(finalDistance / 100),
          };
          
          if (finalProgress > maxProgress) {
            maxProgress = finalProgress;
            leadingCarId = carIdStr;
          }
        }
        
        // Set leading car to 100%
        if (leadingCarId) {
          finalCarPositions[leadingCarId] = { distance: 300, progress: 100, segment: 3 };
        }
        
        this.io.emit('game:race_progress', {
          gameId: game._id.toString(),
          carPositions: finalCarPositions,
          progress: 100,
        });
        this.finishRace(game._id);
        return;
      }
      
      const progress = Math.min(currentUpdate / totalUpdates, 1);
      // Animation time: 0 to animationDuration seconds
      const animationTime = progress * (animationDuration / 1000); // in seconds
      
      // Scale animation time to match fastest car's actual time
      // If fastest car takes fastestTime seconds, scale animationTime to match
      const timeScale = fastestTime / (animationDuration / 1000);
      const scaledAnimationTime = animationTime * timeScale;

      const carPositions = {};
      
      // Calculate positions for all cars based on their ACTUAL speeds per segment
      for (const result of results) {
        // Use scaled animation time directly - this represents actual elapsed time
        const elapsedTime = scaledAnimationTime;
        const totalTime = result.totalTime;
        
        let distance = 0;
        let segmentProgress = 0;
        let currentSegment = 0;

        // If elapsed time >= total time, car has finished (handle floating point precision)
        if (elapsedTime >= totalTime - 0.01) {
          distance = 300;
          currentSegment = 3;
        } else {
          // Calculate distance based on actual segment speeds (no additional scaling)
          for (let i = 0; i < result.segmentTimes.length; i++) {
            const segmentTime = result.segmentTimes[i]; // Actual time for this segment
            
            if (elapsedTime >= segmentProgress + segmentTime) {
              // Completed this segment
              distance += 100; // 100m per segment
              segmentProgress += segmentTime;
              currentSegment = i + 1;
            } else {
              // Currently in this segment - calculate partial distance
              const timeInSegment = elapsedTime - segmentProgress;
              // Speed for this segment = 100m / segmentTime (actual speed for this terrain)
              const speed = 100 / segmentTime; // meters per second
              distance += speed * timeInSegment;
              break;
            }
          }
        }

        const carIdStr = result.carId.toString();
        const finalDistance = Math.min(distance, 300); // Cap at 300m (finish line)
        const finalProgress = Math.min((finalDistance / 300) * 100, 100);
        
        carPositions[carIdStr] = {
          distance: finalDistance,
          progress: finalProgress,
          segment: currentSegment,
        };

        // Check if any car reached finish line (100% progress) - declare winner immediately
        if (finalProgress >= 100 && !winnerReached) {
          winnerReached = true;
          console.log(`[Game Engine] Winner reached finish line! Car: ${carIdStr}, Progress: ${finalProgress.toFixed(1)}%`);
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

      // Finish race ONLY when at least one car reaches finish line (100% progress)
      // But ensure at least 10 updates have been sent for smooth animation
      if (winnerReached && !raceFinished && currentUpdate >= 10) {
        raceFinished = true;
        clearInterval(this.raceAnimationInterval);
        // Send final progress update with actual car positions (not all at 100%)
        this.io.emit('game:race_progress', {
          gameId: game._id.toString(),
          carPositions,
          progress: 100,
        });
        console.log(`[Game Engine] Race finished - winner reached finish line for game ${game.gameNumber}`);
        this.finishRace(game._id);
        return; // Exit interval callback
      }

      // Finish race if animation completed
      // If no car reached 100%, find the car with highest progress and declare it winner
      if (currentUpdate >= totalUpdates && !raceFinished) {
        raceFinished = true;
        clearInterval(this.raceAnimationInterval);
        this.raceAnimationInterval = null;
        
        // Check if any car actually reached 100%
        const anyCarFinished = Object.values(carPositions).some((pos) => pos.progress >= 100);
        
        if (anyCarFinished) {
          // At least one car finished - normal finish
          this.io.emit('game:race_progress', {
            gameId: game._id.toString(),
            carPositions,
            progress: 100,
          });
          console.log(`[Game Engine] Race animation completed - at least one car finished for game ${game.gameNumber}`);
        } else {
          // No car reached 100% - find the car with highest progress and force it to 100%
          // This ensures the race always finishes fairly
          let maxProgress = 0;
          let leadingCarId = null;
          
          for (const [carId, pos] of Object.entries(carPositions)) {
            if (pos.progress > maxProgress) {
              maxProgress = pos.progress;
              leadingCarId = carId;
            }
          }
          
          // Set leading car to 100% and others proportionally
          const adjustedPositions = {};
          for (const [carId, pos] of Object.entries(carPositions)) {
            if (carId === leadingCarId) {
              adjustedPositions[carId] = {
                distance: 300,
                progress: 100,
                segment: 3,
              };
            } else {
              // Keep others at their current progress
              adjustedPositions[carId] = pos;
            }
          }
          
          this.io.emit('game:race_progress', {
            gameId: game._id.toString(),
            carPositions: adjustedPositions,
            progress: 100,
          });
          console.log(`[Game Engine] Race animation completed - no car reached 100%, declaring leader (${leadingCarId}) as winner for game ${game.gameNumber}, max progress was ${maxProgress.toFixed(1)}%`);
        }
        
        this.finishRace(game._id);
        return;
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

      // Record phase times
      const raceEndTime = new Date();
      if (!game.phaseStartTimes) game.phaseStartTimes = {};
      if (!game.phaseEndTimes) game.phaseEndTimes = {};
      game.phaseEndTimes.racing = raceEndTime;
      game.phaseStartTimes.results = raceEndTime;

      game.status = 'finished';
      game.raceEndTime = raceEndTime;
      await game.save();

      // Broadcast results with phase timing
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
          phaseTiming: {
            resultsPhase1Duration: 3000, // 3 seconds - user selections
            resultsPhase2Duration: 5000, // 5 seconds - winner announcement
          },
        },
      });

      console.log(`[Game Engine] Race finished for game ${game.gameNumber} - Phase: results (8s total: 3s selections + 5s winner)`);
      console.log(`[Game Engine] Winning selections: ${winningSelections.length}, Payout per selection: ${winningSelections.length > 0 ? payoutPerSelection.toFixed(2) : 0}`);

      this.currentGame = null;

      // Start next game after results phases (3s + 5s = 8s total)
      // Only start next game if clients are still connected
      console.log('[Game Engine] Starting next game in 8s (after results phases)...');
      if (this.connectedClients.size > 0) {
        const nextGameTimeout = setTimeout(() => {
          if (this.connectedClients.size > 0) {
            // Directly generate new game
            this.generateNewGame();
          } else {
            console.log('[Game Engine] No clients connected, waiting for clients before starting next game...');
            this.isWaitingForClients = true;
          }
        }, 8000); // 8 seconds: 3s phase 1 + 5s phase 2

        // Store timeout for cleanup
        game.nextGameTimeout = nextGameTimeout;
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

