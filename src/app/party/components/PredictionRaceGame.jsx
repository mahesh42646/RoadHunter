"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, useTexture } from "@react-three/drei";
import { Button, Badge } from "react-bootstrap";
import { BsCoin, BsTrophy, BsClock, BsPeople, BsCheckCircle } from "react-icons/bs";
import apiClient from "@/lib/apiClient";
import { getImageUrl } from "@/lib/imageUtils";
import VerticalRaceGame from "@/app/game/components/VerticalRaceGame";

// Track terrain textures and colors - Bright and vibrant
const TERRAIN_STYLES = {
  regular: {
    color: "#6b7280", // Bright grey road
    borderColor: "#ffffff",
    pattern: "dashed",
  },
  desert: {
    color: "#fbbf24", // Bright golden yellow
    borderColor: "#fcd34d",
    pattern: "sandy",
  },
  muddy: {
    color: "#a16207", // Bright brown/tan mud
    borderColor: "#d97706",
    pattern: "muddy",
  },
};

// Track Segment Component with realistic visuals
function TrackSegment({ position, terrain, isVisible, width = 100, height = 50, segmentIndex }) {
  const color = isVisible ? TERRAIN_STYLES[terrain].color : "#1a202c";
  const borderColor = isVisible ? TERRAIN_STYLES[terrain].borderColor : "#374151";

  return (
    <group position={position}>
      {/* Road surface - larger and more prominent */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={color}
          emissive={isVisible ? color : "#000000"}
          emissiveIntensity={isVisible ? 0.3 : 0}
          opacity={isVisible ? 1 : 0.3}
          transparent
          roughness={terrain === "muddy" ? 0.9 : terrain === "desert" ? 0.7 : 0.5}
        />
      </mesh>

      {/* Track border for better visibility */}
      <mesh position={[0, height / 2, 0.05]}>
        <planeGeometry args={[width, 3]} />
        <meshStandardMaterial 
          color={borderColor} 
          emissive={isVisible ? borderColor : "#000000"}
          emissiveIntensity={isVisible ? 0.4 : 0}
        />
      </mesh>
      <mesh position={[0, -height / 2, 0.05]}>
        <planeGeometry args={[width, 3]} />
        <meshStandardMaterial 
          color={borderColor} 
          emissive={isVisible ? borderColor : "#000000"}
          emissiveIntensity={isVisible ? 0.4 : 0}
        />
      </mesh>

      {/* Road markings */}
      {isVisible && terrain === "regular" && (
        <>
          {/* Center dashed line */}
          <mesh position={[0, 0, 0.1]}>
            <planeGeometry args={[2, height * 0.8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Lane dividers */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-width / 3 + (i * width / 3), 0, 0.1]}>
              <planeGeometry args={[1, height * 0.6]} />
              <meshStandardMaterial color="#ffffff" opacity={0.5} transparent />
            </mesh>
          ))}
        </>
      )}

      {/* Terrain-specific obstacles */}
      {isVisible && terrain === "muddy" && (
        <>
          {/* Mud puddles */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-width / 3 + (i * width / 3), 0, 0.05]}>
              <circleGeometry args={[3, 16]} />
              <meshStandardMaterial 
                color="#a16207" 
                emissive="#a16207"
                emissiveIntensity={0.2}
                roughness={1} 
              />
            </mesh>
          ))}
        </>
      )}

      {isVisible && terrain === "desert" && (
        <>
          {/* Sand dunes */}
          {[0, 1].map((i) => (
            <mesh key={i} position={[-width / 4 + (i * width / 2), 0, 0.05]}>
              <planeGeometry args={[8, 4]} />
              <meshStandardMaterial 
                color="#fbbf24" 
                emissive="#fbbf24"
                emissiveIntensity={0.3}
                roughness={0.8} 
              />
            </mesh>
          ))}
        </>
      )}

      {/* Hidden segment indicator */}
      {!isVisible && (
        <Text
          position={[0, 0, 0.2]}
          fontSize={12}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.5}
          outlineColor="#000000"
        >
          ???
        </Text>
      )}

      {/* Terrain label - larger and more visible */}
      {isVisible && segmentIndex === 0 && (
        <Text
          position={[0, height / 2 + 5, 0.2]}
          fontSize={12}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.5}
          outlineColor="#000000"
        >
          {terrain === "regular" ? "🌲 Regular" : terrain === "desert" ? "🏜️ Desert" : "💧 Muddy"}
        </Text>
      )}
    </group>
  );
}

// Animated Car Component - Simple top view image only
function Car({ position, car, progress = 0, isRacing, trackIndex, trackY }) {
  const carRef = useRef();
  const totalLength = 600; // Match track length
  const startX = -totalLength / 2 + 15; // Start position (slightly right of start line)
  const endX = totalLength / 2 - 15; // End position (slightly left of finish line)
  const currentX = startX + (progress / 100) * (endX - startX);

  // Load car image texture - always use topViewImage
  const textureUrl = getImageUrl(car?.topViewImage) || "";
  const carTexture = textureUrl ? useTexture(textureUrl) : null;

  // Animate car movement - smooth interpolation for 30fps+
  useFrame((state, delta) => {
    if (carRef.current) {
      // Use lerp for smooth movement instead of direct assignment
      const targetX = currentX;
      const currentPosX = carRef.current.position.x;
      // Smooth interpolation factor (adjust for responsiveness)
      const lerpFactor = Math.min(1, delta * 20); // Smooth interpolation
      carRef.current.position.x = currentPosX + (targetX - currentPosX) * lerpFactor;
      
      // Keep car aligned with track Y position
      carRef.current.position.y = trackY !== undefined ? trackY : (position[1] || 0);
      // Keep car on track surface
      carRef.current.position.z = 0.1;
    }
  });

  // Fallback color if no image
  const fallbackColor = car?.name?.toLowerCase().includes("red") ? "#dc2626" :
    car?.name?.toLowerCase().includes("blue") ? "#2563eb" :
      car?.name?.toLowerCase().includes("green") ? "#16a34a" :
        car?.name?.toLowerCase().includes("yellow") ? "#eab308" :
          "#6b7280";

  return (
    <group ref={carRef} position={[currentX, trackY !== undefined ? trackY : (position[1] || 0), 0.1]}>
      {/* Car top view image - simple plane (larger size) */}
      {carTexture ? (
        <mesh>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial map={carTexture} transparent />
        </mesh>
      ) : (
        // Fallback: simple colored rectangle if no image
        <mesh>
          <planeGeometry args={[45, 30]} />
          <meshStandardMaterial color={fallbackColor} />
        </mesh>
      )}
    </group>
  );
}

// Race Track Component
function RaceTrack({ track, car, trackIndex, isRacing, carProgress, totalLength = 600 }) {
  const trackHeight = 160; // Track height (increased from 55)
  const trackSpacing = 60; // Spacing between tracks (increased from 65)
  // Center tracks vertically: total height = 3*55 + 2*65 = 295
  // Center at Y=0, so tracks are at: 120, 0, -120
  const totalHeight = (3 * trackHeight) + (2 * trackSpacing); // 295
  const centerY = totalHeight / 2; // 147.5
  const firstTrackY = centerY - (trackHeight / 2); // 120
  const y = firstTrackY - (trackIndex * (trackHeight + trackSpacing)); // Position from top
  
  const segmentWidth = totalLength / track.segments.length;

  return (
    <group position={[0, y, 0]}>
      {/* Track segments */}
      {track.segments.map((terrain, idx) => {
        const x = -totalLength / 2 + idx * segmentWidth + segmentWidth / 2;
        const isVisible = isRacing || idx === 0; // Show first segment always, all during race

        return (
          <TrackSegment
            key={idx}
            position={[x, 0, 0]}
            terrain={terrain}
            isVisible={isVisible}
            width={segmentWidth}
            height={trackHeight}
            segmentIndex={idx}
          />
        );
      })}

      {/* Car - aligned with track center Y position */}
      {car && (
        <Car
          key={`car-${trackIndex}-${car._id || car.toString() || 'unknown'}`}
          position={[0, 0, 0]}
          car={car}
          progress={isRacing ? carProgress : 0}
          isRacing={isRacing}
          trackIndex={trackIndex}
          trackY={0} // Track center Y is 0 relative to group
        />
      )}

      {/* Finish line (checkered flag pattern) */}
      <group position={[totalLength / 2, 0, 0]}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <mesh key={i} position={[0, -trackHeight / 2 + i * (trackHeight / 8), 0.1]}>
            <planeGeometry args={[4, trackHeight / 8]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#ffffff" : "#000000"} />
          </mesh>
        ))}
      </group>

      {/* Start line */}
      <mesh position={[-totalLength / 2, 0, 0]}>
        <planeGeometry args={[3, trackHeight]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

// Speedometer Component
function Speedometer({ speed = 0 }) {
  return (
    <div className="d-none" style={{
      position: "absolute",
      bottom: "10px",
      right: "10px",
      background: "rgba(0, 0, 0, 0.85)",
      borderRadius: "50%",
      width: "100px",
      height: "100px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      border: "3px solid #3b82f6",
      zIndex: 10,
      boxShadow: "0 4px 15px rgba(59, 130, 246, 0.4)",
    }}>
      <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginBottom: "0.2rem" }}>Km/h</div>
      <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#ffffff" }}>{Math.round(speed)}</div>
    </div>
  );
}

export default function PredictionRaceGame({ socket, wallet, onClose, partyId }) {
  // Use the socket passed as prop (from party room)
  const partySocket = socket;
  const [game, setGame] = useState(null);
  const [myPredictions, setMyPredictions] = useState([]); // Array of predictions (multiple selections)
  const [predictionCounts, setPredictionCounts] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [gameStatus, setGameStatus] = useState("waiting");
  const [raceProgress, setRaceProgress] = useState({});
  const [raceResults, setRaceResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(0.8);
  const [resultPhase, setResultPhase] = useState(0); // 0: your result, 1: winner announcement, 2: countdown
  const [countdown, setCountdown] = useState(5);
  const [raceStartCountdown, setRaceStartCountdown] = useState(0); // Countdown before race starts

  const timerIntervalRef = useRef(null);
  const predictionCountIntervalRef = useRef(null);
  const speedIntervalRef = useRef(null);
  const resultPhaseRef = useRef(null);
  const countdownRef = useRef(null);
  const raceStartCountdownRef = useRef(null);
  const loadingRef = useRef(false);
  const lastProcessedGameIdRef = useRef(null); // Track last processed game:finished event
  const currentGameIdRef = useRef(null); // Track current game ID to avoid unnecessary re-renders

  // Responsive camera zoom based on screen width
  useEffect(() => {
    const updateZoom = () => {
      const width = window.innerWidth;
      console.log('[Game] Screen width:', width, 'Setting zoom...');
      if (width < 768) {
        setCameraZoom(0.8); // Mobile
        console.log('[Game] Zoom set to 0.8 (Mobile)');
      } else if (width < 1024) {
        setCameraZoom(1.2); // Tablet
        console.log('[Game] Zoom set to 1.2 (Tablet)');
      } else if (width < 1080) {
        setCameraZoom(2.0); // Laptop
        console.log('[Game] Zoom set to 2.0 (Laptop)');
      } else {
        setCameraZoom(2.2); // Desktop (>1080px)
        console.log('[Game] Zoom set to 2.2 (Desktop)');
      }
    };

    updateZoom();
    window.addEventListener('resize', updateZoom);
    return () => window.removeEventListener('resize', updateZoom);
  }, []);

  // Load active game
  const loadActiveGame = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingRef.current) {
      console.log('[Game] Load already in progress, skipping...');
      return;
    }
    
    loadingRef.current = true;
    try {
      console.log('[Game] Loading active game...');
      const response = await apiClient.get("/games/active");
      console.log('[Game] Active game response:', response.data);
      if (response.data.game) {
        const gameId = response.data.game._id?.toString();
        currentGameIdRef.current = gameId; // Update ref for socket handlers
        setGame(response.data.game);
        const status = response.data.game.status || "predictions";
        setGameStatus(status);
        console.log('[Game] Game status set to:', status);
        setPredictionCounts(response.data.predictionCounts || {});

        if (response.data.game.predictionEndTime) {
          const endTime = new Date(response.data.game.predictionEndTime);
          const now = new Date();
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
          setTimeRemaining(remaining);
        }

        try {
          const predResponse = await apiClient.get("/games/my-predictions", {
            params: { gameId: response.data.game._id }
          });
          if (predResponse.data.predictions) {
            console.log('[Game] Loaded predictions on initial load:', predResponse.data.predictions.map(p => ({
              _id: p._id,
              predictedCarId: p.predictedCarId,
              predictedCarName: p.predictedCarId?.name || p.predictedCarId?._id || 'Unknown',
              payout: p.payout,
              isCorrect: p.isCorrect
            })));
            setMyPredictions(predResponse.data.predictions || []);
          } else {
            setMyPredictions([]);
          }
        } catch (err) {
          // No predictions yet
          console.log('[Game] No predictions found:', err);
          setMyPredictions([]);
        }
      } else {
        currentGameIdRef.current = null; // Clear ref when no game
        setGameStatus("waiting");
      }
    } catch (error) {
      console.error("Error loading game:", error);
      setError("Failed to load game");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Make prediction (add or remove selection)
  const makePrediction = async (carId, action = 'add') => {
    console.log('[Game] makePrediction called:', { carId, action, gameStatus, timeRemaining, predicting, hasGame: !!game, walletBalance: wallet?.partyCoins });
    
    if (!game?._id) {
      console.error('[Game] No game available');
      setError("No active game found");
      return;
    }

    if (gameStatus !== "predictions" || timeRemaining <= 0 || predicting) {
      console.log('[Game] Prediction blocked:', { gameStatus, timeRemaining, predicting });
      return;
    }

    if (action === 'add' && wallet?.partyCoins < 100) {
      setError("Insufficient balance. You need 100 coins per selection.");
      return;
    }

    setPredicting(true);
    setError(null);

    try {
      console.log('[Game] Sending prediction request:', { gameId: game._id, carId, action, partyId });
      const response = await apiClient.post("/games/predict", {
        gameId: game._id,
        carId,
        action,
        partyId: partyId || null,
      });
      console.log('[Game] Prediction response:', response.data);

      // Reload predictions and counts in parallel
      const [predResponse, gameResponse] = await Promise.all([
        apiClient.get("/games/my-predictions", {
          params: { gameId: game._id }
        }),
        apiClient.get("/games/active")
      ]);
      
      console.log('[Game] Reloaded predictions:', predResponse.data);
      console.log('[Game] Reloaded game counts:', gameResponse.data.predictionCounts || gameResponse.data.game?.predictionCounts);
      
      if (predResponse.data.predictions) {
        setMyPredictions(predResponse.data.predictions || []);
      }
      
      // Update counts from server response
      if (gameResponse.data.predictionCounts) {
        setPredictionCounts(gameResponse.data.predictionCounts);
      } else if (gameResponse.data.game?.predictionCounts) {
        setPredictionCounts(gameResponse.data.game.predictionCounts);
      }
      
      // Reload wallet balance
      if (wallet) {
        window.dispatchEvent(new CustomEvent('wallet:refresh'));
      }
    } catch (error) {
      console.error('[Game] Prediction error:', error);
      const errorMessage = error.response?.data?.error || `Failed to ${action} selection`;
      setError(errorMessage);
      
      // If user tried to select a different car, show a more helpful message
      if (errorMessage.includes('You can only select one car per game')) {
        // Error is already set, just log it
        console.log('[Game] User tried to select different car');
      }
    } finally {
      setPredicting(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (gameStatus === "predictions" && timeRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [gameStatus, timeRemaining]);

  // Update prediction counts periodically
  useEffect(() => {
    if (game && gameStatus === "predictions" && partySocket) {
      predictionCountIntervalRef.current = setInterval(() => {
        if (partySocket && game._id) {
          partySocket.emit("game:get_counts", { gameId: game._id });
        }
      }, 2000);
    }

    return () => {
      if (predictionCountIntervalRef.current) {
        clearInterval(predictionCountIntervalRef.current);
      }
    };
  }, [game, gameStatus, partySocket]);

  // Speed animation during race
  useEffect(() => {
    if (gameStatus === "racing") {
      speedIntervalRef.current = setInterval(() => {
        // Simulate speed changes based on race progress
        const speeds = Object.values(raceProgress).map(p => p.progress || 0);
        const avgProgress = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
        const speed = 50 + (avgProgress / 100) * 100; // Speed from 50 to 150 km/h
        setCurrentSpeed(speed);
      }, 100);
    } else {
      setCurrentSpeed(0);
      if (speedIntervalRef.current) {
        clearInterval(speedIntervalRef.current);
      }
    }

    return () => {
      if (speedIntervalRef.current) {
        clearInterval(speedIntervalRef.current);
      }
    };
  }, [gameStatus, raceProgress]);

  // Socket event handlers
  useEffect(() => {
    if (!partySocket) return;

    const handleGameStarted = (data) => {
      // Reset last processed game ID when a new game starts
      if (data.game?._id) {
        lastProcessedGameIdRef.current = null;
        currentGameIdRef.current = data.game._id.toString(); // Update ref for socket handlers
      }
      
      // Don't call loadActiveGame here - we already have the game data from the socket event
      // Calling loadActiveGame would cause a loop by triggering state changes
      setGame(data.game);
      setGameStatus("predictions");
      setMyPredictions([]);
      setRaceProgress({});
      setRaceResults(null);
      setError(null);
      setPredictionCounts({}); // Reset counts

      if (data.game.predictionEndTime) {
        const endTime = new Date(data.game.predictionEndTime);
        const now = new Date();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeRemaining(remaining);
      }

      // Load predictions for this game (but don't reload the entire game)
      if (data.game._id) {
        apiClient.get("/games/my-predictions", {
          params: { gameId: data.game._id }
        }).then((predResponse) => {
          if (predResponse.data.predictions) {
            setMyPredictions(predResponse.data.predictions || []);
          } else {
            setMyPredictions([]);
          }
        }).catch(() => {
          setMyPredictions([]);
        });
      }
    };

    const handlePredictionsLocked = (data) => {
      console.log('[Game] Socket: game:predictions_locked', data);
      setPredictionCounts(data.finalCounts || {});
      setTimeRemaining(0);
      
      // Show 5-second countdown before race starts
      setRaceStartCountdown(5);
      let count = 5;
      raceStartCountdownRef.current = setInterval(() => {
        count--;
        setRaceStartCountdown(count);
        if (count <= 0) {
          clearInterval(raceStartCountdownRef.current);
          setGameStatus("racing");
          setRaceStartCountdown(0);
        }
      }, 1000);
    };

    const handleRaceStart = (data) => {
      setGameStatus("racing");
      if (data.tracks) {
        setGame(prev => ({ ...prev, tracks: data.tracks }));
      }
    };

    const handleRaceProgress = (data) => {
      const currentGameId = currentGameIdRef.current;
      if (data.gameId === currentGameId) {
        setRaceProgress(data.carPositions || {});
        // Force re-render to update car positions (but don't set to null)
        setGame(prev => prev ? { ...prev } : prev);
      }
    };

    const handleRaceFinished = (data) => {
      console.log('[Game] Race finished event received:', data);
      
      // Guard: Prevent processing the same game:finished event multiple times
      const gameId = data.game?._id?.toString();
      if (gameId && lastProcessedGameIdRef.current === gameId) {
        console.log('[Game] Already processed finish event for game:', gameId, 'skipping...');
        return;
      }
      
      // Mark this game as processed
      if (gameId) {
        lastProcessedGameIdRef.current = gameId;
      }
      
      // Clear any existing timers
      if (resultPhaseRef.current) {
        clearTimeout(resultPhaseRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      
      // Always update results regardless of game ID match
      if (data.game) {
        // First, update game state with winner info
        setGame(prev => prev ? {
          ...prev,
          winnerCarId: data.game.winnerCarId,
          winnerName: data.game.winnerName,
        } : null);
        
        // Reload my prediction to get updated payout info BEFORE setting status
        if (data.game._id) {
          apiClient.get("/games/my-predictions", {
            params: { gameId: data.game._id }
          }).then((predResponse) => {
            if (predResponse.data.predictions) {
              console.log('[Game] Updated predictions for user:', predResponse.data.predictions.map(p => ({
                _id: p._id,
                predictedCarId: p.predictedCarId,
                predictedCarName: p.predictedCarId?.name || p.predictedCarId?._id,
                payout: p.payout,
                isCorrect: p.isCorrect
              })));
              setMyPredictions(predResponse.data.predictions || []);
            } else {
              console.log('[Game] No predictions found for this user');
              setMyPredictions([]);
            }
            // Now set status and results after prediction is loaded
            setGameStatus("finished");
            setRaceResults(data.game.results || []);
            setRaceProgress({});
            setCurrentSpeed(0);
            setResultPhase(1); // Start with phase 1 (winner announcement)
            setCountdown(10);
            
            // Phase 1: Show winner announcement for 10 seconds
            resultPhaseRef.current = setTimeout(() => {
              setResultPhase(0); // Move to user result
              
              // Phase 0: Show your result for 10 seconds
              resultPhaseRef.current = setTimeout(() => {
                setResultPhase(2); // Move to countdown
                
                // Phase 2: Countdown from 10 to 1 (10 seconds)
                let count = 10;
                setCountdown(count);
                countdownRef.current = setInterval(() => {
                  count--;
                  setCountdown(count);
                  if (count <= 0) {
                    clearInterval(countdownRef.current);
                    // Load next game
                    loadActiveGame();
                  }
                }, 1000);
              }, 10000);
            }, 10000);
          }).catch((err) => {
            console.log('[Game] No prediction found or error:', err);
            // Still show results even if prediction load fails
            setGameStatus("finished");
            setRaceResults(data.game.results || []);
            setRaceProgress({});
            setCurrentSpeed(0);
            setResultPhase(1); // Start with winner announcement
            setCountdown(10);
            
            // Phase 1: Show winner announcement for 10 seconds
            resultPhaseRef.current = setTimeout(() => {
              setResultPhase(0); // Move to user result
              resultPhaseRef.current = setTimeout(() => {
                setResultPhase(2); // Move to countdown
                let count = 10;
                setCountdown(count);
                countdownRef.current = setInterval(() => {
                  count--;
                  setCountdown(count);
                  if (count <= 0) {
                    clearInterval(countdownRef.current);
                    loadActiveGame();
                  }
                }, 1000);
              }, 10000);
            }, 10000);
          });
        } else {
          // No game ID, just set status
          setGameStatus("finished");
          setRaceResults(data.game.results || []);
          setRaceProgress({});
          setCurrentSpeed(0);
          setResultPhase(0);
          setCountdown(5);
        }
      } else {
        // If no game data, try to load active game
        console.log('[Game] No game data in finish event, loading active game...');
        loadActiveGame();
      }
    };

    const handlePredictionCounts = (data) => {
      const currentGameId = currentGameIdRef.current;
      if (data.gameId === currentGameId) {
        setPredictionCounts(data.counts || {});
      }
    };

    partySocket.on("game:started", handleGameStarted);
    partySocket.on("game:predictions_locked", handlePredictionsLocked);
    partySocket.on("game:race_start", handleRaceStart);
    partySocket.on("game:race_progress", handleRaceProgress);
    partySocket.on("game:finished", handleRaceFinished);
    partySocket.on("game:prediction_counts", handlePredictionCounts);

    return () => {
      partySocket.off("game:started", handleGameStarted);
      partySocket.off("game:predictions_locked", handlePredictionsLocked);
      partySocket.off("game:race_start", handleRaceStart);
      partySocket.off("game:race_progress", handleRaceProgress);
          partySocket.off("game:finished", handleRaceFinished);
          partySocket.off("game:prediction_counts", handlePredictionCounts);
          
          // Cleanup result phase timers
          if (resultPhaseRef.current) {
            clearTimeout(resultPhaseRef.current);
          }
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }
          if (raceStartCountdownRef.current) {
            clearInterval(raceStartCountdownRef.current);
          }
        };
      }, [partySocket]); // Only depend on socket, not game ID to prevent re-registration loops

  // Initial load
  useEffect(() => {
    loadActiveGame();
  }, [loadActiveGame]);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "400px" }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-muted">Loading game...</p>
        </div>
      </div>
    );
  }

  // Don't show waiting state - always show current game state
  // If no game, show loading or empty state
  if (!game && !loading) {
    return (
      <div className="text-center p-4" style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: "0.75rem",
        minHeight: "300px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}>
        <h4 className="mb-3" style={{
          color: "#ffffff",
          textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
          fontWeight: "bold"
        }}>
          🏎️ PREDICTION RACE
        </h4>
        <p className="text-white mb-2">No active game at the moment</p>
        <p className="small text-white-50">A new race will start soon...</p>
      </div>
    );
  }

  const totalPot = game.totalPot || Object.values(predictionCounts).reduce((a, b) => a + b, 0) * 100;
  const platformFee = totalPot * 0.05;
  const winnerPool = totalPot - platformFee;
  
  // Calculate potential payout for user's selections
  const myTotalSelections = myPredictions.length;
  const potentialPayout = myTotalSelections > 0 && totalPot > 0
    ? Math.floor(winnerPool / Object.values(predictionCounts).reduce((a, b) => a + b, 0)) * myTotalSelections
    : 0;

  const getCarById = (carId) => {
    if (!carId || !game?.cars) return null;
    const carAssignment = game.cars.find(c =>
      c.carId?._id?.toString() === carId.toString() ||
      c.carId?.toString() === carId.toString()
    );
    return carAssignment?.carId;
  };

  // Use vertical game by default in party game
  return (
    <div style={{ height: "100%", width: "100%" }}>
      <VerticalRaceGame 
        socket={partySocket} 
        wallet={wallet} 
        onClose={onClose}
        partyId={partyId}
      />
    </div>
  );

  // Old 3D game code kept below (not used, but preserved for reference)
  // The code below is kept but never executed due to return statement above
  /*
  return (
    <div className="prediction-race-game" style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
      borderRadius: "0.75rem",
      overflow: "hidden",
      position: "relative",
      minHeight: 0, // Allow flex shrinking
    }}>
    
      {/* Carbon fiber texture overlay */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px),
          repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)
        `,
        pointerEvents: "none",
        zIndex: 1,
      }} />

      {/* Header */}
      <div 
      className="pb-2 px-3 pt-1"
      style={{
        background: "rgba(0, 0, 0, 0.4)",
        borderBottom: "2px solid rgba(255, 255, 255, 0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 2,
        position: "relative",
        flexShrink: 0,
      }}>
        <div className="d-flex align-items-center gap-2">
          <h6 className="mb-0" style={{
            color: "#ffffff",
            fontWeight: "bold",
          }}>
            🏎️ PREDICTION RACE
             #{game.gameNumber}
          </h6>
          <div>
            {/* Timer */}
            {gameStatus === "predictions" && (
              <div style={{
                padding: "0.1rem",
                textAlign: "center",
                background: "rgba(0, 0, 0, 0.3)",
                zIndex: 2,
                position: "relative",
                flexShrink: 0,
              }}>
                <Badge
                  bg={timeRemaining > 10 ? "success" : timeRemaining > 5 ? "warning" : "danger"}
                  style={{
                    fontSize: "0.9rem",
                    padding: "0.4rem 0.8rem",
                    fontWeight: "bold",
                  }}
                >
                  <BsClock className="me-2" />
                  {timeRemaining}s
                </Badge>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div className="d-flex px-3" style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#fbbf24" }}>
              <BsCoin size={18} />
              <strong style={{ fontSize: "1rem" }}>{totalPot.toLocaleString()}</strong>
            </div>
          
          </div>
        </div>
      </div>



      {/* Error Message */}
      {error && (
        <div style={{
          padding: "0.5rem 1rem",
          background: "rgba(220, 38, 38, 0.2)",
          borderLeft: "3px solid #dc2626",
          color: "#fca5a5",
          margin: "0.5rem",
          borderRadius: "0.25rem",
          zIndex: 2,
          position: "relative",
          flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* Race Track Canvas - Fill 70% of top section */}
      <div style={{
        flex: 0.5,
        height: "auto",
        background: "linear-gradient(to bottom, #1e293b 0%, #0f172a 100%)",
        zIndex: 2,   }} >
        <Canvas
          camera={{ 
            height: 1000,
            position: [0, 0, 300], 
            zoom: cameraZoom,
            left: -300,
            right: 300,
            top: 285, // Increased to accommodate taller tracks (3*80 + 2*90 = 420, center = 210, top = 210 + 75 = 285)
            bottom: -285, // Increased to accommodate taller tracks
          }}
          orthographic
          style={{ width: "100%", height: "100%", margin: 0, padding: 0 }}
        >
          <ambientLight intensity={1.5} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          <directionalLight position={[0, 10, 5]} intensity={1.2} />
          <pointLight position={[-10, 10, 10]} intensity={1} />

          {game.tracks && game.tracks.map((track, idx) => {
            const carAssignment = game.cars?.find((c) => c.trackNumber === idx + 1);
            const car = carAssignment?.carId;
            const carId = car?._id?.toString() || car?.toString() || car?._id || car;
            const carProgress = raceProgress[carId]?.progress || 0;

            return (
              <RaceTrack
                key={`track-${idx}-${carId || 'no-car'}`}
                track={track}
                car={car}
                trackIndex={idx}
                isRacing={gameStatus === "racing"}
                carProgress={carProgress}
              />
            );
          })}
        </Canvas>

        {/* Race start countdown overlay */}
        {raceStartCountdown > 0 && gameStatus !== "racing" && (
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0, 0, 0, 0.9)",
            padding: "2rem 3rem",
            borderRadius: "1rem",
            color: "#ffffff",
            fontWeight: "bold",
            border: "3px solid #3b82f6",
            zIndex: 200,
            textAlign: "center",
            boxShadow: "0 0 30px rgba(59, 130, 246, 0.6)",
          }}>
            <div style={{
              fontSize: "1.5rem",
              marginBottom: "1rem",
            }}>
              Race starting in...
            </div>
            <div style={{
              fontSize: "4rem",
              color: "#3b82f6",
              textShadow: "0 0 20px rgba(59, 130, 246, 0.8)",
            }}>
              {raceStartCountdown}
            </div>
          </div>
        )}

        {/* Speedometer during race only - positioned bottom right */}
        {gameStatus === "racing" && <Speedometer speed={currentSpeed} />}

        {/* Race status overlay */}
        {gameStatus === "racing" && (
          <div style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            background: "rgba(0, 0, 0, 0.8)",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            color: "#ffffff",
            fontWeight: "bold",
            border: "2px solid #3b82f6",
            zIndex: 10,
          }}>
            🏁 
          </div>
        )}
        
      </div>

      {/* Car Selection Cards - Horizontal scrollable */}
      {gameStatus === "predictions" && (
        <div style={{
          // padding: "0.75rem",
          background: "rgba(0, 0, 0, 0.4)",
          zIndex: 2,
          position: "relative",
          flexShrink: 0,
        }}>
          <div
          className=" border"
          style={{
            display: "flex",
            // gap: "0.75rem",
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarColor: "#3b82f6 rgba(0,0,0,0.3)",
          }}>
            {game.cars.map((carAssignment) => {
              const car = carAssignment.carId;
              const carId = car._id?.toString() || car?.toString();
              const count = predictionCounts[carId] || 0;
              
              // Get user's selections for this car
              const myCarSelections = myPredictions.filter(
                p => p.predictedCarId?.toString() === carId || p.predictedCarId?._id?.toString() === carId
              );
              const mySelectionCount = myCarSelections.length;
              const hasSelections = mySelectionCount > 0;
              
              // Check if user has selections on a different car
              const hasOtherSelections = myPredictions.length > 0 && mySelectionCount === 0;
              
              const isDisabled = timeRemaining <= 0 || predicting;
              const canAdd = wallet?.partyCoins >= 100 && !isDisabled && !hasOtherSelections;
              const canRemove = mySelectionCount > 0 && !isDisabled;

              return (
                <div
                className="col-md-3 col-4 p-2"
                  key={carId}
                  onClick={(e) => {
                    // If clicking on card (not buttons), add a selection if possible
                    if (canAdd && !e.target.closest('button')) {
                      makePrediction(carId, 'add');
                    } else if (hasOtherSelections && !e.target.closest('button')) {
                      // Show message that user can only select one car
                      setError(" can select one car per game.");
                    }
                  }}
                  style={{
                    background: hasSelections
                      ? "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(147, 51, 234, 0.3) 100%)"
                      : "rgba(30, 41, 59, 0.8)",
                    borderRadius: "0.5rem",
                    
                    position: "relative",
                   
                    boxShadow: hasSelections ? "0 0 15px rgba(59, 130, 246, 0.5)" : "none",
                  
                    cursor: canAdd ? "pointer" : "default",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (canAdd) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (canAdd) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = hasSelections ? "0 0 15px rgba(59, 130, 246, 0.5)" : "none";
                    }
                  }}
                >
                  {/* Car image - Side view */}
                  <div 
                  className="border "
                  style={{
                    width: "100%",
                   height: "5rem",
                   
                   
                    background: getImageUrl(car.sideViewImage)
                      ? `url(${getImageUrl(car.sideViewImage)}) center/cover no-repeat`
                      : "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: "0.5rem",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                  }}>
                    {!getImageUrl(car.sideViewImage) && (
                      <div style={{
                        fontSize: "2rem",
                        color: "rgba(255, 255, 255, 0.5)",
                      }}>
                        🚗
                      </div>
                    )}
                    {hasSelections && (
                      <BsCheckCircle
                        style={{
                          position: "absolute",
                          top: "5px",
                          right: "5px",
                          color: "#10b981",
                          fontSize: "1.2rem",
                          background: "rgba(0, 0, 0, 0.8)",
                          borderRadius: "50%",
                          padding: "2px",
                          zIndex: 2,
                        }}
                      />
                    )}
                  </div>

                  {/* Car name */}
                  <div style={{
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    color: "#ffffff",
                    marginBottom: "0.25rem",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {car.name}

                  
                  </div>

                  {/* Stats */}
                  <div style={{
                    fontSize: "0.7rem",
                    color: "#9ca3af",
                    marginBottom: "0.5rem",
                    textAlign: "center",
                  }}>
                    {car.speedRegular}/{car.speedDesert}/{car.speedMuddy}
                  </div>

                  {/* Selection controls */}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.1rem",
                    marginTop: "0.12rem",
                  }}>
                    {/* My selections count */}
                    {/* {mySelectionCount > 0 && (
                      <div style={{
                        fontSize: "0.7rem",
                        color: "#10b981",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}>
                        Your selections: {mySelectionCount}
                      </div>
                    )} */}
                    
                    {/* Increment/Decrement buttons */}
                    <div
                    className="border p-1 rounded"
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canRemove) makePrediction(carId, 'remove');
                        }}
                        disabled={!canRemove}
                        style={{
                          width: "28px",
                          height: "28px",
                          // borderRadius: "50%",
                          border: "1px solid rgba(255, 255, 255, 0.3)",
                          background: canRemove ? "rgba(220, 38, 38, 0.3)" : "rgba(107, 114, 128, 0.3)",
                          color: "#ffffff",
                          cursor: canRemove ? "pointer" : "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1rem",
                          fontWeight: "bold",
                        }}
                      >
                        −
                      </button>
                      
                      <div
                      
                       style={{
                        fontSize: "0.9rem",
                        fontWeight: "bold",
                        color: "#ffffff",
                        minWidth: "30px",
                        textAlign: "center",
                      }}>
                        {mySelectionCount}
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canAdd) makePrediction(carId, 'add');
                        }}
                        disabled={!canAdd}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          border: "1px solid rgba(255, 255, 255, 0.3)",
                          background: canAdd ? "rgba(16, 185, 129, 0.3)" : "rgba(107, 114, 128, 0.3)",
                          color: "#ffffff",
                          cursor: canAdd ? "pointer" : "not-allowed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1rem",
                          fontWeight: "bold",
                        }}
                      >
                        +
                      </button>
                    </div>
                    
                    {/* Total selections and investment */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.7rem",
                      marginTop: "0.1rem",
                      position: "absolute",
                      top: "0.8rem",
                      left: "0.6rem",
                      right: "0.6rem",
                    }}>
                      <div style={{ color: "black", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <BsPeople size={10} />
                        <span>{count}</span>
                      </div>
                      <div style={{ color: "black", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <BsCoin size={10} />
                        <span>{count * 100}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selection summary */}
          {myPredictions.length > 0 && (
            <div style={{
              marginTop: "0.75rem",
              padding: "0.5rem",
              background: "rgba(59, 130, 246, 0.2)",
              borderRadius: "0.5rem",
              textAlign: "center",
              fontSize: "0.85rem",
              color: "#ffffff",
            }}>
              ✅ {myPredictions.length} selection{myPredictions.length > 1 ? 's' : ''} placed ({myPredictions.length * 100} coins)
            </div>
          )}
        </div>
      )}

      {/* Race Results - Multi-phase display */}
      {gameStatus === "finished" && raceResults && raceResults.length > 0 && (
        <div style={{
          padding: "1rem",
          background: "rgba(0, 0, 0, 0.6)",
          zIndex: 2,
          position: "relative",
          flexShrink: 0,
        }}>
          {(() => {
            // Get winner from results or game state
            const winnerResult = raceResults && raceResults.length > 0 ? raceResults[0] : null;
            const winnerCarIdFromResult = winnerResult?.carId?.toString();
            const winnerCarIdFromGame = game?.winnerCarId?.toString() || game?.winnerCarId?._id?.toString();
            const winnerCarIdStr = winnerCarIdFromResult || winnerCarIdFromGame;
            
            const winnerCar = winnerCarIdStr 
              ? (getCarById(winnerCarIdStr) || { name: game?.winnerName || "Unknown" })
              : { name: game?.winnerName || "Unknown" };
            
            // Check if user won (any of their selections)
            // Normalize car IDs for comparison
            const normalizeCarId = (carId) => {
              if (!carId) return null;
              if (typeof carId === 'string') return carId;
              if (carId._id) return carId._id.toString();
              if (carId.toString) return carId.toString();
              return null;
            };
            
            const normalizedWinnerCarId = normalizeCarId(winnerCarIdStr);
            console.log('[Game Results] Winner car ID:', normalizedWinnerCarId);
            console.log('[Game Results] My predictions:', myPredictions.map(p => ({
              predCarId: p.predictedCarId,
              predCarIdStr: normalizeCarId(p.predictedCarId),
              payout: p.payout,
              isCorrect: p.isCorrect
            })));
            
            const winningSelections = myPredictions.filter(p => {
              const predCarIdStr = normalizeCarId(p.predictedCarId);
              const isMatch = predCarIdStr && normalizedWinnerCarId && (predCarIdStr === normalizedWinnerCarId);
              console.log('[Game Results] Comparing:', { predCarIdStr, normalizedWinnerCarId, isMatch });
              return isMatch;
            });
            
            const isWinner = winningSelections.length > 0;
            const totalPayout = winningSelections.reduce((sum, p) => sum + (p.payout || 0), 0);
            const totalInvested = myPredictions.length * 100;
            const totalLoss = isWinner ? 0 : totalInvested;
            
            // Get all cars user selected (should only be one car now)
            const selectedCarIds = [...new Set(myPredictions.map(p => normalizeCarId(p.predictedCarId)).filter(Boolean))];
            const selectedCars = selectedCarIds.map(carId => getCarById(carId)).filter(Boolean);
            
            console.log('[Game Results] Selected cars:', selectedCars.map(c => c.name));
            console.log('[Game Results] Is winner:', isWinner, 'Total payout:', totalPayout);

            // Phase 1: Winner announcement (first 10 seconds)
            if (resultPhase === 1) {
              return (
                <div style={{
                  textAlign: "center",
                  padding: "0.5rem",
                  background: "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(147, 51, 234, 0.3) 100%)",
                  borderRadius: "0.75rem",
                  border: "2px solid #3b82f6",
                }}>
                  <div style={{
                    fontSize: "2rem",
                    fontWeight: "bold",
                    color: "#ffffff",
                    marginBottom: "0.1rem",
                    textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
                  }}>
                    🏆 WINNER CAR
                  </div>
                  <div style={{
                    fontSize: "1.5rem",
                    color: "#fbbf24",
                    marginBottom: "0.1rem",
                    fontWeight: "bold",
                  }}>
                    {winnerCar?.name || "Unknown"}
                  </div>
                  {isWinner && (
                    <div style={{
                      fontSize: "1.2rem",
                      color: "#10b981",
                      fontWeight: "bold",
                    }}>
                      🎉 You won the race! Congrats! 🎉
                    </div>
                  )}
                </div>
              );
            }

            // Phase 0: Your result (second 10 seconds - after winner announcement)
            if (resultPhase === 0) {
              return (
                <div style={{
                  textAlign: "center",
                  padding: "1.5rem",
                  background: isWinner
                    ? "linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.3) 100%)"
                    : "linear-gradient(135deg, rgba(220, 38, 38, 0.3) 0%, rgba(185, 28, 28, 0.3) 100%)",
                  borderRadius: "0.75rem",
                  border: `2px solid ${isWinner ? "#10b981" : "#dc2626"}`,
                }}>
                  <div style={{
                    fontSize: "2rem",
                    fontWeight: "bold",
                    color: "#ffffff",
                    marginBottom: "0.5rem",
                    textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
                  }}>
                    {myPredictions.length > 0 ? (isWinner ? "🎉 CORRECT PREDICTION!" : "😔 INCORRECT PREDICTION") : "🏁 RACE FINISHED"}
                  </div>
                  {myPredictions.length > 0 && (
                    <>
                      <div style={{
                        fontSize: "1.2rem",
                        color: "#ffffff",
                        marginBottom: "0.5rem",
                        fontWeight: "bold",
                      }}>
                        You made {myPredictions.length} selection{myPredictions.length > 1 ? 's' : ''}
                      </div>
                      {selectedCars.length > 0 && (
                        <div style={{
                          fontSize: "0.9rem",
                          color: "#9ca3af",
                          marginBottom: "1rem",
                        }}>
                          Selected: {selectedCars.map(c => c.name).join(", ")}
                        </div>
                      )}
                      <div style={{
                        fontSize: "1rem",
                        color: "#fbbf24",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        marginBottom: "0.5rem",
                      }}>
                        <BsCoin />
                        {isWinner ? (
                          <span>Virtual reward: {totalPayout.toLocaleString()} Party Coins (entertainment only)</span>
                        ) : (
                          <span>Virtual coins used: {totalLoss.toLocaleString()} Party Coins</span>
                        )}
                      </div>
                      {isWinner && winningSelections.length > 0 && (
                        <div style={{
                          fontSize: "0.85rem",
                          color: "#10b981",
                          marginTop: "0.5rem",
                        }}>
                          {winningSelections.length} winning selection{winningSelections.length > 1 ? 's' : ''} × {winningSelections[0]?.payout?.toLocaleString() || 0} coins each
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            }


            // Phase 2: Countdown (last 10 seconds)
            if (resultPhase === 2) {
              return (
                <div style={{
                  textAlign: "center",
                  padding: "0.5rem",
                  background: "linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)",
                  borderRadius: "0.75rem",
                  border: "2px solid #3b82f6",
                }}>
                  <div style={{
                    fontSize: "1.2rem",
                    color: "#ffffff",
                    marginBottom: "0.3rem",
                  }}>
                    Next game starts in
                  </div>
                  <div style={{
                    fontSize: "3rem",
                    fontWeight: "bold",
                    color: "#3b82f6",
                    textShadow: "0 0 20px rgba(14, 95, 225, 0.8)",
                  }}>
                    {countdown}
                  </div>
                </div>
              );
            }

            return null;
          })()}
        </div>
      )}
    </div>
  );
  */
}











