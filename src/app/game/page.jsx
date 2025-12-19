"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Badge, Button } from "react-bootstrap";
import {
  BsClock,
  BsCoin,
  BsPeople,
  BsCheckCircle,
  BsArrowRepeat,
} from "react-icons/bs";

import apiClient from "@/lib/apiClient";
import useAuthStore from "@/store/useAuthStore";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.darkunde.in";

// Terrain colors - realistic highway, desert, and mud
const TERRAIN_COLORS = {
  regular: "#2a2d35", // Dark asphalt/gray highway
  desert: "#d4a574", // Sandy beige desert
  muddy: "#6b4423", // Dark brown mud
};

function formatNumber(value) {
  if (value == null) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

function normalizeCarId(carId) {
  if (!carId) return null;
  if (typeof carId === "string") return carId;
  if (carId._id) return carId._id.toString();
  if (carId.toString) return carId.toString();
  return null;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Generate fixed obstacles for a segment (prevents flickering)
function generateObstacles(terrain, laneX, laneWidth, segmentY, segmentHeight, segmentPadding, gameId, trackIndex, segmentIndex) {
  const key = `${gameId}-${trackIndex}-${segmentIndex}`;
  
  // Use seeded random for consistent positions
  let seed = 0;
  for (let i = 0; i < key.length; i++) {
    seed = ((seed << 5) - seed) + key.charCodeAt(i);
    seed = seed & seed; // Convert to 32bit integer
  }
  
  // Simple seeded random function
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  const obstacles = [];
  const minX = laneX + segmentPadding * 2;
  const maxX = laneX + laneWidth - segmentPadding * 2;
  const minY = segmentY;
  const maxY = segmentY + segmentHeight;
  
  if (terrain === "desert") {
    // Generate stones
    const stoneCount = Math.max(6, Math.floor(laneWidth * segmentHeight / 800));
    for (let i = 0; i < stoneCount; i++) {
      obstacles.push({
        type: "stone",
        x: minX + seededRandom() * (maxX - minX),
        y: minY + seededRandom() * (maxY - minY),
        size: Math.max(2, laneWidth * 0.02 + seededRandom() * laneWidth * 0.03),
        rotation: seededRandom() * Math.PI * 2,
      });
    }
    
    // Generate sand texture dots
    const sandDotCount = Math.max(8, Math.floor(laneWidth * segmentHeight / 200));
    for (let i = 0; i < sandDotCount; i++) {
      obstacles.push({
        type: "sandDot",
        x: minX + seededRandom() * (maxX - minX),
        y: minY + seededRandom() * (maxY - minY),
        size: Math.max(0.5, laneWidth * 0.008),
      });
    }
  } else if (terrain === "muddy") {
    // Generate potholes
    const potholeCount = Math.max(3, Math.floor(laneWidth / 60));
    for (let i = 0; i < potholeCount; i++) {
      obstacles.push({
        type: "pothole",
        x: minX + seededRandom() * (maxX - minX),
        y: minY + seededRandom() * (maxY - minY),
        size: Math.max(4, laneWidth * 0.1 + seededRandom() * laneWidth * 0.1),
        rotation: seededRandom() * Math.PI * 2,
      });
    }
    
    // Generate mud patches
    const mudPatchCount = Math.max(4, Math.floor(laneWidth / 40));
    for (let i = 0; i < mudPatchCount; i++) {
      obstacles.push({
        type: "mudPatch",
        x: minX + seededRandom() * (maxX - minX),
        y: minY + seededRandom() * (maxY - minY),
        size: Math.max(3, laneWidth * 0.06 + seededRandom() * laneWidth * 0.08),
        rotation: seededRandom() * Math.PI * 2,
        widthScale: 0.8 + seededRandom() * 0.4,
        heightScale: 0.6 + seededRandom() * 0.4,
      });
    }
    
    // Add debris/rocks in mud
    const debrisCount = Math.max(2, Math.floor(laneWidth / 80));
    for (let i = 0; i < debrisCount; i++) {
      obstacles.push({
        type: "debris",
        x: minX + seededRandom() * (maxX - minX),
        y: minY + seededRandom() * (maxY - minY),
        size: Math.max(2, laneWidth * 0.03 + seededRandom() * laneWidth * 0.04),
      });
    }
  } else {
    // Regular road - road markings and wear
    const wearPatchCount = Math.max(2, Math.floor(laneWidth / 80));
    for (let i = 0; i < wearPatchCount; i++) {
      obstacles.push({
        type: "wearPatch",
        x: minX + seededRandom() * (maxX - minX),
        y: minY + seededRandom() * (maxY - minY),
        size: Math.max(2, laneWidth * 0.04),
      });
    }
    
    // Add small cracks
    const crackCount = Math.max(1, Math.floor(laneWidth / 100));
    for (let i = 0; i < crackCount; i++) {
      obstacles.push({
        type: "crack",
        x: minX + seededRandom() * (maxX - minX),
        y: minY + seededRandom() * (maxY - minY),
        length: Math.max(5, laneWidth * 0.1 + seededRandom() * laneWidth * 0.15),
        rotation: seededRandom() * Math.PI * 2,
      });
    }
  }
  
  return obstacles;
}

// Particle class for dust and mud effects
class Particle {
  constructor(x, y, type = "dust", scale = 1) {
    this.x = x;
    this.y = y;
    this.type = type; // "dust" or "mud"
    this.vx = (Math.random() - 0.5) * 2 * scale;
    this.vy = (Math.random() * 1.5 + 0.5) * scale;
    this.life = 1.0;
    this.decay = Math.random() * 0.02 + 0.01;
    // Size scales with car size (scale parameter)
    this.size = (Math.random() * 3 + 2) * scale;
    this.angle = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.angle += this.rotationSpeed;
    this.vy *= 0.98; // Gravity effect
    return this.life > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    
    if (this.type === "dust") {
      // Golden dust particles
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Brown mud particles
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

// Draw realistic 2D arcade-style car
function drawArcadeCar(ctx, x, y, width, height, color, carName = "") {
  const carTop = y - height / 2;
  const carLeft = x - width / 2;
  
  // Car body (main shape)
  ctx.fillStyle = color;
  drawRoundedRect(ctx, carLeft, carTop, width, height, width * 0.15);
  ctx.fill();
  
  // Car body highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  drawRoundedRect(
    ctx,
    carLeft + width * 0.1,
    carTop + height * 0.1,
    width * 0.8,
    height * 0.3,
    width * 0.1
  );
  ctx.fill();
  
  // Windshield (front)
  ctx.fillStyle = "rgba(135, 206, 250, 0.6)";
  drawRoundedRect(
    ctx,
    carLeft + width * 0.15,
    carTop + height * 0.15,
    width * 0.7,
    height * 0.25,
    width * 0.1
  );
  ctx.fill();
  
  // Windshield frame
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 1;
  drawRoundedRect(
    ctx,
    carLeft + width * 0.15,
    carTop + height * 0.15,
    width * 0.7,
    height * 0.25,
    width * 0.1
  );
  ctx.stroke();
  
  // Side windows
  ctx.fillStyle = "rgba(30, 30, 50, 0.7)";
  ctx.fillRect(carLeft + width * 0.2, carTop + height * 0.45, width * 0.25, height * 0.2);
  ctx.fillRect(carLeft + width * 0.55, carTop + height * 0.45, width * 0.25, height * 0.2);
  
  // Roof stripe/racing stripe
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillRect(carLeft + width * 0.4, carTop + height * 0.35, width * 0.2, height * 0.15);
  
  // Wheels (4 wheels)
  const wheelSize = width * 0.15;
  const wheelY1 = carTop + height * 0.25;
  const wheelY2 = carTop + height * 0.75;
  const wheelX1 = carLeft + width * 0.2;
  const wheelX2 = carLeft + width * 0.8;
  
  // Wheel shadows
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.arc(wheelX1, wheelY1, wheelSize, 0, Math.PI * 2);
  ctx.arc(wheelX2, wheelY1, wheelSize, 0, Math.PI * 2);
  ctx.arc(wheelX1, wheelY2, wheelSize, 0, Math.PI * 2);
  ctx.arc(wheelX2, wheelY2, wheelSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Wheels
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(wheelX1, wheelY1, wheelSize * 0.9, 0, Math.PI * 2);
  ctx.arc(wheelX2, wheelY1, wheelSize * 0.9, 0, Math.PI * 2);
  ctx.arc(wheelX1, wheelY2, wheelSize * 0.9, 0, Math.PI * 2);
  ctx.arc(wheelX2, wheelY2, wheelSize * 0.9, 0, Math.PI * 2);
  ctx.fill();
  
  // Wheel rims
  ctx.fillStyle = "#666";
  ctx.beginPath();
  ctx.arc(wheelX1, wheelY1, wheelSize * 0.6, 0, Math.PI * 2);
  ctx.arc(wheelX2, wheelY1, wheelSize * 0.6, 0, Math.PI * 2);
  ctx.arc(wheelX1, wheelY2, wheelSize * 0.6, 0, Math.PI * 2);
  ctx.arc(wheelX2, wheelY2, wheelSize * 0.6, 0, Math.PI * 2);
  ctx.fill();
  
  // Car number/name
  if (carName) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.font = `bold ${Math.max(8, width * 0.2)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(carName, x, carTop + height * 0.5);
    ctx.fillText(carName, x, carTop + height * 0.5);
  }
}

export default function Html5RaceGamePage() {
  const token = useAuthStore((state) => state.token);

  const [socket, setSocket] = useState(null);
  const [game, setGame] = useState(null);
  const [predictionCounts, setPredictionCounts] = useState({});
  const [myPredictions, setMyPredictions] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [gameStatus, setGameStatus] = useState("waiting"); // predictions | racing | finished | waiting
  const [raceProgress, setRaceProgress] = useState({});
  const [raceResults, setRaceResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState(null);
  const [raceStartCountdown, setRaceStartCountdown] = useState(0);
  const [resultPhase, setResultPhase] = useState(0); // 0: your result, 1: winner, 2: next game countdown
  const [resultCountdown, setResultCountdown] = useState(0);

  const timerIntervalRef = useRef(null);
  const predictionCountIntervalRef = useRef(null);
  const raceStartCountdownRef = useRef(null);
  const resultPhaseTimeoutRef = useRef(null);
  const resultCountdownIntervalRef = useRef(null);

  const raceCanvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const carImagesRef = useRef({});
  const particlesRef = useRef({}); // Store particles per car
  const obstaclesRef = useRef({}); // Store fixed obstacle positions per game/segment
  const latestStateRef = useRef({
    game: null,
    raceProgress: {},
    gameStatus: "waiting",
  });
  const [footerHeight, setFooterHeight] = useState(70); // Default footer height

  useEffect(() => {
    latestStateRef.current = { game, raceProgress, gameStatus };
  }, [game, raceProgress, gameStatus]);

  // Measure footer height dynamically
  useEffect(() => {
    const measureFooter = () => {
      // Find the bottom nav element - try multiple selectors
      let bottomNav = document.querySelector('nav.position-fixed.bottom-0');
      if (!bottomNav) {
        bottomNav = document.querySelector('nav.d-md-none.position-fixed.bottom-0');
      }
      if (!bottomNav) {
        // Try finding by data attribute or class name containing MobileBottomNav
        const navs = document.querySelectorAll('nav');
        for (const nav of navs) {
          const rect = nav.getBoundingClientRect();
          if (rect.bottom >= window.innerHeight - 10 && rect.top < window.innerHeight) {
            bottomNav = nav;
            break;
          }
        }
      }
      
      if (bottomNav) {
        const rect = bottomNav.getBoundingClientRect();
        const height = rect.height || bottomNav.offsetHeight;
        if (height > 0) {
          setFooterHeight(height);
          return;
        }
      }
      
      // Fallback: use default height based on screen size
      const isMobile = window.innerWidth < 768;
      setFooterHeight(isMobile ? 70 : 0); // Only show on mobile
    };

    // Measure on mount
    measureFooter();
    
    // Measure on resize
    window.addEventListener('resize', measureFooter);
    
    // Measure after DOM updates
    const timeout1 = setTimeout(measureFooter, 100);
    const timeout2 = setTimeout(measureFooter, 500);
    const timeout3 = setTimeout(measureFooter, 1000);

    // Use MutationObserver to detect when footer is added/removed
    const observer = new MutationObserver(measureFooter);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', measureFooter);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      observer.disconnect();
    };
  }, []);

  // Preload car top view images
  useEffect(() => {
    if (!game?.cars) return;
    game.cars.forEach((assignment) => {
      const car = assignment.carId;
      if (!car) return;
      const carId = normalizeCarId(car._id || car);
      const imageUrl = car.topViewImage;
      if (imageUrl && !carImagesRef.current[carId]) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          carImagesRef.current[carId] = img;
        };
        img.onerror = () => {
          console.warn(`Failed to load car image: ${imageUrl}`);
        };
        img.src = imageUrl;
      }
    });
  }, [game]);

  // Establish dedicated game socket
  useEffect(() => {
    const s = io(SOCKET_URL, {
      auth: token ? { token } : undefined,
      transports: ["websocket", "polling"],
    });

    s.on("connect", () => {
      s.emit("user:join");
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [token]);

  const loadActiveGame = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get("/games/active");

      if (response.data.game) {
        const activeGame = response.data.game;
        setGame(activeGame);
        const status = activeGame.status || "predictions";
        setGameStatus(status);
        setPredictionCounts(response.data.predictionCounts || {});

        // Handle different game states when user enters mid-game
        if (status === "predictions" && activeGame.predictionEndTime) {
          const endTime = new Date(activeGame.predictionEndTime);
          const now = new Date();
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
          setTimeRemaining(remaining);
          
          // If predictions already locked but status is still "predictions", check if we need to transition
          if (remaining <= 0 && status === "predictions") {
            // Predictions should be locked, wait for socket event or check again
            setTimeout(() => {
              loadActiveGame();
            }, 1000);
          }
        } else if (status === "racing") {
          // Race is in progress - reset progress and wait for socket updates
          setRaceProgress({});
          setTimeRemaining(0);
          // Request race progress from socket if connected
          if (socket && activeGame._id) {
            socket.emit("game:get_progress", { gameId: activeGame._id });
          }
        } else if (status === "finished") {
          // Game finished - load results
          setTimeRemaining(0);
          // Results should be loaded via socket event, but we can also fetch them here
        } else {
          setTimeRemaining(0);
        }

        try {
          const predResponse = await apiClient.get("/games/my-predictions", {
            params: { gameId: activeGame._id },
          });
          setMyPredictions(predResponse.data.predictions || []);
        } catch {
          setMyPredictions([]);
        }
      } else {
        // No active game - but don't show "waiting" state, keep polling for new game
        setGame(null);
        setGameStatus("waiting");
        setTimeRemaining(0);
        setPredictionCounts({});
        setMyPredictions([]);
        // Poll aggressively (every 500ms) to catch new game immediately
        setTimeout(() => {
          loadActiveGame();
        }, 500);
      }
    } catch (err) {
      console.error("[Html5RaceGame] Failed to load active game", err);
      setError("Failed to load game. Please try again.");
      // Retry after error
      setTimeout(() => {
        loadActiveGame();
      }, 3000);
    } finally {
      setLoading(false);
    }
  }, [socket]);

  useEffect(() => {
    loadActiveGame();
  }, [loadActiveGame]);

  // Prediction countdown timer
  useEffect(() => {
    if (gameStatus === "predictions" && timeRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [gameStatus, timeRemaining]);

  // Prediction counts polling
  useEffect(() => {
    if (!socket || !game || gameStatus !== "predictions") return;

    predictionCountIntervalRef.current = setInterval(() => {
      socket.emit("game:get_counts", { gameId: game._id });
    }, 2000);

    return () => {
      if (predictionCountIntervalRef.current) {
        clearInterval(predictionCountIntervalRef.current);
      }
    };
  }, [socket, game, gameStatus]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleGameStarted = (data) => {
      if (!data?.game) return;
      setGame(data.game);
      setGameStatus("predictions");
      setMyPredictions([]);
      setRaceProgress({});
      setRaceResults(null);
      setPredictionCounts({});
      setError(null);
      
      // Clear obstacles for new game
      obstaclesRef.current = {};

      if (data.game.predictionEndTime) {
        const endTime = new Date(data.game.predictionEndTime);
        const now = new Date();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(0);
      }
    };

    const handlePredictionsLocked = (data) => {
      // Exact same logic as party game
      setPredictionCounts(data.finalCounts || {});
      setTimeRemaining(0);
      
      setRaceStartCountdown(5);
      let count = 5;
      raceStartCountdownRef.current = setInterval(() => {
        count -= 1;
        setRaceStartCountdown(count);
        if (count <= 0) {
          clearInterval(raceStartCountdownRef.current);
          raceStartCountdownRef.current = null;
          setGameStatus("racing");
        }
      }, 1000);
    };

    const handleRaceStart = (data) => {
      // Exact same logic as party game
      console.log('[Game] Race start event received:', data);
      setGameStatus("racing");
      setRaceProgress({}); // Reset progress when race starts
      if (data.tracks) {
        setGame(prev => prev ? { ...prev, tracks: data.tracks } : prev);
      }
      // Clear any countdown
      if (raceStartCountdownRef.current) {
        clearInterval(raceStartCountdownRef.current);
        raceStartCountdownRef.current = null;
      }
      setRaceStartCountdown(0);
    };

    const handleRaceProgress = (data) => {
      // Exact same logic as party game - simple and direct
      const currentGameId = game?._id?.toString();
      if (data.gameId === currentGameId) {
        if (gameStatus === "racing") {
          setRaceProgress(data.carPositions || {});
          // Force re-render to update car positions
          setGame(prev => prev ? { ...prev } : prev);
        } else {
          console.log('[Game] Race progress received but game status is not racing:', gameStatus);
        }
      } else {
        console.log('[Game] Race progress received for different game:', data.gameId, 'current:', currentGameId);
      }
    };

    const handleRaceFinished = async (data) => {
      if (!data?.game) {
        loadActiveGame();
        return;
      }

      setGame((prev) =>
        prev
          ? {
              ...prev,
              winnerCarId: data.game.winnerCarId,
              winnerName: data.game.winnerName,
            }
          : null
      );
      setRaceResults(data.game.results || []);
      setRaceProgress({});
      setGameStatus("finished");

      try {
        const predResponse = await apiClient.get("/games/my-predictions", {
          params: { gameId: data.game._id },
        });
        setMyPredictions(predResponse.data.predictions || []);
      } catch {
        setMyPredictions([]);
      }

      // Use fixed timing from backend: 3s phase 1 + 5s phase 2 = 8s total
      const phase1Duration = data.game?.phaseTiming?.resultsPhase1Duration || 3000; // 3 seconds
      const phase2Duration = data.game?.phaseTiming?.resultsPhase2Duration || 5000; // 5 seconds

      setResultPhase(0); // Start with phase 0: user selections
      setResultCountdown(Math.ceil(phase1Duration / 1000)); // 3 seconds

      if (resultPhaseTimeoutRef.current) clearTimeout(resultPhaseTimeoutRef.current);
      if (resultCountdownIntervalRef.current)
        clearInterval(resultCountdownIntervalRef.current);

      // Phase 0: User selections (3 seconds)
      let countdown1 = Math.ceil(phase1Duration / 1000);
      resultCountdownIntervalRef.current = setInterval(() => {
        countdown1 -= 1;
        setResultCountdown(countdown1);
        if (countdown1 <= 0) {
          clearInterval(resultCountdownIntervalRef.current);
          resultCountdownIntervalRef.current = null;
        }
      }, 1000);

      resultPhaseTimeoutRef.current = setTimeout(() => {
        setResultPhase(1); // Switch to phase 1: winner announcement
        setResultCountdown(Math.ceil(phase2Duration / 1000)); // 5 seconds

        // Phase 1: Winner announcement (5 seconds)
        let countdown2 = Math.ceil(phase2Duration / 1000);
        resultCountdownIntervalRef.current = setInterval(() => {
          countdown2 -= 1;
          setResultCountdown(countdown2);
          if (countdown2 <= 0) {
            clearInterval(resultCountdownIntervalRef.current);
            resultCountdownIntervalRef.current = null;
            // Backend starts new game after 8s, so load it
            loadActiveGame();
          }
        }, 1000);
      }, phase1Duration);
    };

    const handlePredictionCounts = (data) => {
      if (game && data.gameId === game._id) {
        setPredictionCounts(data.counts || {});
      }
    };

    socket.on("game:started", handleGameStarted);
    socket.on("game:predictions_locked", handlePredictionsLocked);
    socket.on("game:race_start", handleRaceStart);
    socket.on("game:race_progress", handleRaceProgress);
    socket.on("game:finished", handleRaceFinished);
    socket.on("game:prediction_counts", handlePredictionCounts);

    return () => {
      socket.off("game:started", handleGameStarted);
      socket.off("game:predictions_locked", handlePredictionsLocked);
      socket.off("game:race_start", handleRaceStart);
      socket.off("game:race_progress", handleRaceProgress);
      socket.off("game:finished", handleRaceFinished);
      socket.off("game:prediction_counts", handlePredictionCounts);
    };
  }, [socket, game, loadActiveGame]);

  // Place or remove prediction for a car
  const makePrediction = async (carId, action = "add") => {
    if (!game?._id || predicting) return;
    if (gameStatus !== "predictions" || timeRemaining <= 0) return;

    setPredicting(true);
    setError(null);

    try {
      await apiClient.post("/games/predict", {
        gameId: game._id,
        carId,
        action,
        partyId: null,
      });

      const [predResponse, gameResponse] = await Promise.all([
        apiClient.get("/games/my-predictions", { params: { gameId: game._id } }),
        apiClient.get("/games/active"),
      ]);

      setMyPredictions(predResponse.data.predictions || []);

      if (gameResponse.data.predictionCounts) {
        setPredictionCounts(gameResponse.data.predictionCounts);
      } else if (gameResponse.data.game?.predictionCounts) {
        setPredictionCounts(gameResponse.data.game.predictionCounts);
      }
    } catch (err) {
      console.error("[Html5RaceGame] Prediction error", err);
      const msg =
        err?.response?.data?.error ||
        (action === "add" ? "Failed to add selection" : "Failed to remove selection");
      setError(msg);
    } finally {
      setPredicting(false);
    }
  };

  // Canvas drawing loop
  useEffect(() => {
    let retryTimeout = null;
    let animationId = null;
    let isDrawing = false;
    let resizeObserver = null;
    let forceResizeHandler = null;
    
    const initCanvas = () => {
      const canvas = raceCanvasRef.current;
      if (!canvas) {
        // Retry after a short delay
        retryTimeout = setTimeout(initCanvas, 50);
        return;
      }
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("[RaceCanvas] Could not get 2D context");
        return;
      }
      
      console.log("[RaceCanvas] Canvas initialized successfully");
      
      // Canvas is ready, proceed with setup
      setupCanvas(canvas, ctx);
    };
    
    const setupCanvas = (canvas, ctx) => {

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) {
        return;
      }
      
      const rect = parent.getBoundingClientRect();
      // Use computed style to get actual height if rect is 0
      const computedStyle = window.getComputedStyle(parent);
      const parentWidth = rect.width || parseFloat(computedStyle.width) || 400;
      const parentHeight = rect.height || parseFloat(computedStyle.height) || 600;
      
      const width = Math.max(parentWidth, 300);
      const height = Math.max(parentHeight, 200);
      const dpr = window.devicePixelRatio || 1;
      
      if (width > 0 && height > 0) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        // Reset transform and scale for high DPI
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
    };

      // Force initial resize
      const forceResize = () => {
        resize();
        // Try again after a short delay
        setTimeout(resize, 100);
        setTimeout(resize, 500);
      };
      
      forceResizeHandler = forceResize;
      forceResize();
      window.addEventListener("resize", forceResize);
      
      // Also resize when container size changes
      if (canvas.parentElement) {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              resize();
            }
          }
        });
        resizeObserver.observe(canvas.parentElement);
        
        // Also observe the grandparent (the flex container) to catch height changes
        const grandparent = canvas.parentElement.parentElement;
        if (grandparent) {
          resizeObserver.observe(grandparent);
        }
      }

    const draw = () => {
      if (!canvas || !ctx) return;
      
      const { game: g, raceProgress: progressMap, gameStatus: status } =
        latestStateRef.current;

      // Get actual canvas dimensions
      const dpr = window.devicePixelRatio || 1;
      let width = canvas.width / dpr;
      let height = canvas.height / dpr;
      
      // Fallback to client dimensions if canvas not initialized
      if (width <= 0 || height <= 0) {
        width = canvas.clientWidth || 400;
        height = canvas.clientHeight || 600;
        if (width <= 0 || height <= 0) {
          if (isDrawing) {
            animationId = requestAnimationFrame(draw);
          }
          return;
        }
      }

      // Clear entire canvas
      ctx.clearRect(0, 0, width, height);

      // Background grass with 3D gradient - ALWAYS DRAW THIS FIRST
      const grassGradient = ctx.createLinearGradient(0, 0, 0, height);
      grassGradient.addColorStop(0, "#2db366"); // Lighter at top
      grassGradient.addColorStop(0.5, "#1f9d55"); // Medium
      grassGradient.addColorStop(1, "#178045"); // Darker at bottom
      ctx.fillStyle = grassGradient;
      ctx.fillRect(0, 0, width, height);
      
      // Add grass texture (subtle)
      ctx.fillStyle = "rgba(40, 150, 80, 0.15)";
      for (let i = 0; i < Math.floor(height / 20); i++) {
        const y = i * 20;
        ctx.fillRect(0, y, width, 1);
      }

      // Always draw 3 lanes even if game data isn't loaded yet
      const laneCount = 3;
      // Responsive road width: scales with canvas but maintains margins
      const margin = width * 0.05; // 5% margin on each side
      const roadWidth = width - (margin * 2);
      const roadLeft = margin;
      const roadRight = roadLeft + roadWidth;
      const laneWidth = roadWidth / laneCount;

      // Main road surface with 3D gradient (darker edges, lighter center)
      const roadGradient = ctx.createLinearGradient(roadLeft, 0, roadRight, 0);
      roadGradient.addColorStop(0, "#1f2126"); // Dark edge
      roadGradient.addColorStop(0.5, "#2a2d35"); // Lighter center
      roadGradient.addColorStop(1, "#1f2126"); // Dark edge
      ctx.fillStyle = roadGradient;
      ctx.fillRect(roadLeft, 0, roadWidth, height);
      
      // Road border with shadow for 3D effect (scales with canvas)
      const borderWidth = Math.max(1, width * 0.008); // ~0.8% of width, min 1px
      
      // Border shadow (darker)
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = borderWidth * 1.5;
      ctx.strokeRect(roadLeft + 1, 1, roadWidth - 2, height - 2);
      
      // Main border (white)
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(roadLeft, 0, roadWidth, height);

      // Road edges with 3D effect (white lines with shadow) - scales with canvas
      const edgeWidth = Math.max(1, width * 0.01); // ~1% of width
      
      // Left edge shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(roadLeft - edgeWidth + 1, 1, edgeWidth, height - 2);
      
      // Left edge highlight
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(roadLeft - edgeWidth, 0, edgeWidth, height);
      
      // Right edge shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(roadRight + 1, 1, edgeWidth, height - 2);
      
      // Right edge highlight
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(roadRight, 0, edgeWidth, height);

      // Red/white striped barrier on right edge - scales with canvas
      const barrierWidth = Math.max(2, width * 0.02); // ~2% of width
      const barrierSpacing = Math.max(8, height * 0.04); // ~4% of height
      const stripeHeight = barrierSpacing / 2;
      ctx.fillStyle = "#ffffff";
      for (let y = 0; y < height; y += barrierSpacing) {
        ctx.fillRect(roadRight + edgeWidth, y, barrierWidth, stripeHeight);
      }
      ctx.fillStyle = "#dc2626";
      for (let y = stripeHeight; y < height; y += barrierSpacing) {
        ctx.fillRect(roadRight + edgeWidth, y, barrierWidth, stripeHeight);
      }

      // Lane dividers (dashed white lines) - scales with canvas
      const dividerLineWidth = Math.max(1, width * 0.005); // ~0.5% of width
      const dashLength = Math.max(10, height * 0.02); // ~2% of height
      const dashGap = dashLength * 0.75;
      ctx.setLineDash([dashLength, dashGap]);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = dividerLineWidth;
      for (let i = 1; i < laneCount; i += 1) {
        const x = roadLeft + laneWidth * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Track segments with different terrain patterns
      const trackHeight = height * 0.85;
      const trackTop = height * 0.1;
      const segmentCount = 3;
      const segmentHeight = trackHeight / segmentCount;

      // During predictions: only show first 30% of track from BOTTOM (start line area), rest is hidden
      // During racing: show full track
      const isPredictions = status === "predictions";
      const visibleTrackHeight = isPredictions ? trackHeight * 0.3 : trackHeight;
      // Visible area starts from bottom (start line), so hidden area is at the top
      const visibleTrackStart = isPredictions ? trackTop + (trackHeight - visibleTrackHeight) : trackTop;
      const hiddenTrackStart = trackTop;
      const hiddenTrackHeight = isPredictions ? trackHeight - visibleTrackHeight : 0;

      // Get tracks from game or use defaults
      const tracks = g?.tracks || [
        { segments: ["regular", "regular", "regular"] },
        { segments: ["desert", "desert", "desert"] },
        { segments: ["muddy", "muddy", "muddy"] },
      ];

      tracks.forEach((track, laneIndex) => {
        const laneX = roadLeft + laneWidth * laneIndex;
        const segments = track.segments || ["regular", "regular", "regular"];

        // Segments are drawn top-to-bottom (idx 0=top, 2=bottom)
        // But backend segments are bottom-to-top (segment 0=start/bottom, 2=finish/top)
        // Reverse the index when accessing terrain
        segments.forEach((terrain, idx) => {
          // Visual position: idx 0 at top, idx 2 at bottom
          const y = trackTop + idx * segmentHeight;
          const segmentBottom = y + segmentHeight;
          
          // Backend segment index: reverse (idx 2 -> segment 0, idx 0 -> segment 2)
          const backendSegmentIdx = segments.length - 1 - idx;
          const actualTerrain = segments[backendSegmentIdx];
          
          // During predictions: check if segment is in visible area (bottom 30%)
          if (isPredictions) {
            // If segment is completely in hidden area (top 70%), draw grayed out
            if (segmentBottom <= visibleTrackStart) {
              // This segment is completely in hidden area, draw grayed out
              ctx.fillStyle = "#1a1a1a"; // Dark gray for hidden
              ctx.fillRect(laneX, y, laneWidth, segmentHeight);
              
              // Add "???" text in hidden segments
              ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
              ctx.font = `bold ${Math.max(12, laneWidth * 0.15)}px Arial`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("???", laneX + laneWidth / 2, y + segmentHeight / 2);
              return;
            }
            
            // If segment is partially visible, only draw visible part
            if (y < visibleTrackStart) {
              // Segment starts in hidden area, only draw visible part
              const drawY = visibleTrackStart;
              const drawHeight = segmentBottom - visibleTrackStart;
              if (drawHeight <= 0) return;
              
              // Draw visible part with terrain
              const terrainKey = actualTerrain === "hidden" ? "regular" : actualTerrain;
              const terrainColor = TERRAIN_COLORS[terrainKey] || TERRAIN_COLORS.regular;
              const segmentPadding = Math.max(1, laneWidth * 0.02);
              ctx.fillStyle = terrainColor;
              ctx.fillRect(laneX + segmentPadding, drawY, laneWidth - (segmentPadding * 2), drawHeight);
              return; // Skip patterns for partial segments
            }
          }
          
          // Segment is fully visible (or during racing)
          const drawY = y;
          const drawHeight = segmentHeight;
          
          const terrainKey = actualTerrain === "hidden" ? "regular" : actualTerrain;
          const terrainColor = TERRAIN_COLORS[terrainKey] || TERRAIN_COLORS.regular;

          // Responsive padding - scales with lane width
          const segmentPadding = Math.max(1, laneWidth * 0.02); // 2% of lane width
          
          // Fill terrain segment with 3D gradient effect (only visible part)
          const roadWidth = laneWidth - (segmentPadding * 2);
          const roadX = laneX + segmentPadding;
          
          // Create 3D gradient (lighter in center, darker on edges for depth)
          const roadGradient = ctx.createLinearGradient(
            roadX,
            drawY,
            roadX + roadWidth,
            drawY
          );
          
          // Adjust gradient colors based on terrain
          if (terrainKey === "regular") {
            roadGradient.addColorStop(0, "#1f2126"); // Dark edge
            roadGradient.addColorStop(0.5, "#2a2d35"); // Lighter center
            roadGradient.addColorStop(1, "#1f2126"); // Dark edge
          } else if (terrainKey === "desert") {
            roadGradient.addColorStop(0, "#c49a5f"); // Darker sand edge
            roadGradient.addColorStop(0.5, "#d4a574"); // Lighter center
            roadGradient.addColorStop(1, "#c49a5f"); // Darker sand edge
          } else {
            roadGradient.addColorStop(0, "#5a3520"); // Darker mud edge
            roadGradient.addColorStop(0.5, "#6b4423"); // Lighter center
            roadGradient.addColorStop(1, "#5a3520"); // Darker mud edge
          }
          
          ctx.fillStyle = roadGradient;
          ctx.fillRect(roadX, drawY, roadWidth, drawHeight);
          
          // Add subtle top highlight for 3D effect
          const highlightGradient = ctx.createLinearGradient(
            roadX,
            drawY,
            roadX,
            drawY + Math.min(drawHeight * 0.3, 10)
          );
          highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
          highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = highlightGradient;
          ctx.fillRect(roadX, drawY, roadWidth, Math.min(drawHeight * 0.3, 10));

          // Add terrain-specific patterns with fixed obstacles (no flickering) and 3D effects
          if (drawHeight > 0) {
            const gameId = g?._id?.toString() || "default";
            const obstacleKey = `${gameId}-${laneIndex}-${idx}`;
            
            // Get or generate fixed obstacles for this segment
            if (!obstaclesRef.current[obstacleKey]) {
              obstaclesRef.current[obstacleKey] = generateObstacles(
                terrainKey,
                laneX,
                laneWidth,
                drawY,
                drawHeight,
                segmentPadding,
                gameId,
                laneIndex,
                idx
              );
            }
            
            const obstacles = obstaclesRef.current[obstacleKey];
            
            // Draw obstacles with 3D effects
            obstacles.forEach((obstacle) => {
              // Ensure obstacle is within visible bounds
              const minX = laneX + segmentPadding * 2;
              const maxX = laneX + laneWidth - segmentPadding * 2;
              const minY = drawY;
              const maxY = drawY + drawHeight;
              
              // Clamp obstacle position to segment bounds
              const obsX = Math.max(minX, Math.min(maxX, obstacle.x));
              const obsY = Math.max(minY, Math.min(maxY, obstacle.y));
              
              if (obstacle.type === "stone") {
                // 3D stone with shadow and highlight
                const shadowOffset = obstacle.size * 0.2;
                
                // Stone shadow (darker, offset)
                ctx.fillStyle = "rgba(100, 80, 60, 0.6)";
                ctx.beginPath();
                ctx.ellipse(
                  obsX + shadowOffset,
                  obsY + shadowOffset,
                  obstacle.size * 0.9,
                  obstacle.size * 0.5,
                  0,
                  0,
                  Math.PI * 2
                );
                ctx.fill();
                
                // Stone base (3D gradient effect)
                const gradient = ctx.createRadialGradient(
                  obsX - obstacle.size * 0.3,
                  obsY - obstacle.size * 0.3,
                  0,
                  obsX,
                  obsY,
                  obstacle.size
                );
                gradient.addColorStop(0, "rgba(160, 140, 110, 0.9)");
                gradient.addColorStop(0.5, "rgba(120, 100, 80, 0.9)");
                gradient.addColorStop(1, "rgba(90, 70, 50, 0.9)");
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(obsX, obsY, obstacle.size, 0, Math.PI * 2);
                ctx.fill();
                
                // Stone highlight (top-left)
                ctx.fillStyle = "rgba(180, 160, 130, 0.7)";
                ctx.beginPath();
                ctx.arc(obsX - obstacle.size * 0.3, obsY - obstacle.size * 0.3, obstacle.size * 0.4, 0, Math.PI * 2);
                ctx.fill();
              } else if (obstacle.type === "sandDot") {
                // Simple sand texture dot
                ctx.fillStyle = "rgba(200, 163, 69, 0.3)";
                ctx.beginPath();
                ctx.arc(obsX, obsY, obstacle.size, 0, Math.PI * 2);
                ctx.fill();
              } else if (obstacle.type === "pothole") {
                // 3D pothole with depth effect
                const depth = obstacle.size * 0.3;
                
                // Pothole shadow (inner darkness)
                ctx.fillStyle = "rgba(40, 25, 15, 0.9)";
                ctx.beginPath();
                ctx.ellipse(obsX, obsY, obstacle.size, obstacle.size * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Pothole rim highlight (3D edge)
                const rimGradient = ctx.createLinearGradient(
                  obsX - obstacle.size,
                  obsY,
                  obsX + obstacle.size,
                  obsY
                );
                rimGradient.addColorStop(0, "rgba(140, 100, 70, 0.8)");
                rimGradient.addColorStop(0.5, "rgba(100, 70, 45, 0.9)");
                rimGradient.addColorStop(1, "rgba(80, 55, 35, 0.8)");
                ctx.strokeStyle = rimGradient;
                ctx.lineWidth = Math.max(1, laneWidth * 0.012);
                ctx.beginPath();
                ctx.ellipse(obsX, obsY, obstacle.size, obstacle.size * 0.6, 0, 0, Math.PI * 2);
                ctx.stroke();
                
                // Inner pothole highlight (depth illusion)
                ctx.fillStyle = "rgba(60, 40, 25, 0.6)";
                ctx.beginPath();
                ctx.ellipse(obsX, obsY + depth, obstacle.size * 0.7, obstacle.size * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
              } else if (obstacle.type === "mudPatch") {
                // 3D mud patch with irregular shape
                ctx.save();
                ctx.translate(obsX, obsY);
                ctx.rotate(obstacle.rotation);
                
                // Mud patch shadow
                ctx.fillStyle = "rgba(70, 45, 25, 0.6)";
                ctx.beginPath();
                ctx.ellipse(
                  0,
                  obstacle.size * 0.2,
                  obstacle.size * obstacle.widthScale,
                  obstacle.size * obstacle.heightScale,
                  0,
                  0,
                  Math.PI * 2
                );
                ctx.fill();
                
                // Mud patch (gradient for 3D)
                const mudGradient = ctx.createRadialGradient(
                  -obstacle.size * 0.2,
                  -obstacle.size * 0.2,
                  0,
                  0,
                  0,
                  obstacle.size
                );
                mudGradient.addColorStop(0, "rgba(110, 75, 45, 0.8)");
                mudGradient.addColorStop(1, "rgba(80, 50, 30, 0.8)");
                ctx.fillStyle = mudGradient;
                ctx.beginPath();
                ctx.ellipse(
                  0,
                  0,
                  obstacle.size * obstacle.widthScale,
                  obstacle.size * obstacle.heightScale,
                  0,
                  0,
                  Math.PI * 2
                );
                ctx.fill();
                
                ctx.restore();
              } else if (obstacle.type === "debris") {
                // Debris/rock in mud
                ctx.fillStyle = "rgba(60, 50, 40, 0.9)";
                ctx.beginPath();
                ctx.arc(obsX, obsY, obstacle.size, 0, Math.PI * 2);
                ctx.fill();
                
                // Debris highlight
                ctx.fillStyle = "rgba(80, 70, 60, 0.7)";
                ctx.beginPath();
                ctx.arc(obsX - obstacle.size * 0.3, obsY - obstacle.size * 0.3, obstacle.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
              } else if (obstacle.type === "wearPatch") {
                // Road wear (subtle 3D)
                const wearGradient = ctx.createRadialGradient(obsX, obsY, 0, obsX, obsY, obstacle.size);
                wearGradient.addColorStop(0, "rgba(220, 220, 220, 0.15)");
                wearGradient.addColorStop(1, "rgba(200, 200, 200, 0.05)");
                ctx.fillStyle = wearGradient;
                ctx.beginPath();
                ctx.arc(obsX, obsY, obstacle.size, 0, Math.PI * 2);
                ctx.fill();
              } else if (obstacle.type === "crack") {
                // Road crack
                ctx.strokeStyle = "rgba(100, 100, 100, 0.6)";
                ctx.lineWidth = Math.max(0.5, laneWidth * 0.003);
                ctx.beginPath();
                ctx.moveTo(obsX, obsY);
                ctx.lineTo(
                  obsX + Math.cos(obstacle.rotation) * obstacle.length,
                  obsY + Math.sin(obstacle.rotation) * obstacle.length
                );
                ctx.stroke();
              }
            });
            
            // Add terrain-specific base patterns
            if (terrainKey === "regular") {
              // Center line (dashed) - 3D effect
              const centerLineY = drawY + drawHeight / 2;
              const dashLength = Math.max(8, drawHeight * 0.15);
              const dashGap = dashLength * 0.5;
              
              // Line shadow
              ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
              ctx.lineWidth = Math.max(1, laneWidth * 0.011);
              ctx.setLineDash([dashLength, dashGap]);
              ctx.beginPath();
              ctx.moveTo(laneX + laneWidth / 2, drawY + 1);
              ctx.lineTo(laneX + laneWidth / 2, drawY + drawHeight + 1);
              ctx.stroke();
              
              // Main line
              ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
              ctx.lineWidth = Math.max(1, laneWidth * 0.01);
              ctx.beginPath();
              ctx.moveTo(laneX + laneWidth / 2, drawY);
              ctx.lineTo(laneX + laneWidth / 2, drawY + drawHeight);
              ctx.stroke();
              ctx.setLineDash([]);
              
              // Road texture lines (subtle)
              const textureLineWidth = Math.max(0.5, laneWidth * 0.0015);
              ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
              const textureLineCount = Math.max(4, Math.floor(drawHeight / 15));
              for (let i = 0; i < textureLineCount; i += 1) {
                const texX = laneX + segmentPadding;
                const texY = drawY + (i * drawHeight) / textureLineCount;
                ctx.fillRect(texX, texY, laneWidth - (segmentPadding * 2), textureLineWidth);
              }
            }
          }
        });
      });

      // Draw hidden/grayed out area during predictions
      if (isPredictions && hiddenTrackHeight > 0) {
        // Dark overlay for hidden track area
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; // Dark overlay
        ctx.fillRect(roadLeft, hiddenTrackStart, roadWidth, hiddenTrackHeight);
        
        // Add "???" marks in hidden area
        const questionMarkSize = Math.max(16, Math.min(laneWidth * 0.2, height * 0.03));
        const questionSpacing = questionMarkSize * 2;
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = `bold ${questionMarkSize}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Draw "???" in each lane of hidden area
        for (let laneIdx = 0; laneIdx < laneCount; laneIdx++) {
          const laneCenterX = roadLeft + laneWidth * laneIdx + laneWidth / 2;
          for (let y = hiddenTrackStart + questionSpacing; y < hiddenTrackStart + hiddenTrackHeight; y += questionSpacing) {
            ctx.fillText("???", laneCenterX, y);
          }
        }
      }

      // Start line (white line at bottom) - scales with canvas
      const startY = trackTop + trackHeight;
      const startLinePadding = Math.max(2, roadWidth * 0.02); // 2% of road width
      const startLineHeight = Math.max(2, height * 0.008); // ~0.8% of height
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(
        roadLeft + startLinePadding,
        startY - startLineHeight,
        roadWidth - (startLinePadding * 2),
        startLineHeight
      );

      // Finish line Y position (always needed for car positioning)
      const finishY = trackTop;

      // Finish line (checkered pattern at top) - only show during racing
      if (!isPredictions) {
        const cellSize = Math.max(6, Math.min(roadWidth * 0.03, height * 0.02)); // Scales with both width and height
        const finishLinePadding = Math.max(2, roadWidth * 0.02);
        const finishLineHeight = cellSize * 2; // Two rows of cells
        for (let x = roadLeft + finishLinePadding; x < roadRight - finishLinePadding; x += cellSize) {
          for (let y = finishY - cellSize; y < finishY + finishLineHeight; y += cellSize) {
            const isBlack =
              (Math.floor((x - roadLeft - finishLinePadding) / cellSize) +
                Math.floor((y - finishY + cellSize) / cellSize)) %
                2 ===
              0;
            ctx.fillStyle = isBlack ? "#000000" : "#ffffff";
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        }
      }

      // Draw cars - always show cars even if no game data
      // Car size scales proportionally with lane width and segment height
      const cars = g?.cars || [];
      const baseCarSize = Math.min(
        laneWidth * 0.7, // 70% of lane width
        segmentHeight * 0.35, // 35% of segment height
        height * 0.08 // Max 8% of canvas height to prevent oversized cars
      );

      // If no cars from game, create placeholder cars for each lane
      const carsToDraw = cars.length > 0 ? cars : [
        { carId: { _id: "car1", name: "Car 1" }, trackNumber: 1 },
        { carId: { _id: "car2", name: "Car 2" }, trackNumber: 2 },
        { carId: { _id: "car3", name: "Car 3" }, trackNumber: 3 },
      ];
      
      // Always draw at least 3 cars
      const finalCars = carsToDraw.length >= 3 ? carsToDraw : [
        ...carsToDraw,
        ...Array(3 - carsToDraw.length).fill(null).map((_, i) => ({
          carId: { _id: `placeholder${i}`, name: `Car ${i + 1}` },
          trackNumber: carsToDraw.length + i + 1,
        })),
      ];

      finalCars.slice(0, 3).forEach((assignment, idx) => {
        const car = assignment?.carId || assignment;
        if (!car) return;
        const trackIndex = (assignment.trackNumber || 1) - 1;
        const laneX = roadLeft + laneWidth * trackIndex;
        const centerX = laneX + laneWidth / 2;

        // Get car ID (exact same logic as party game)
        const carId = car?._id?.toString() || car?.toString() || car?._id || car;
        
        // Get car progress (exact same logic as party game)
        const carProgress = status === "racing" ? (progressMap[carId]?.progress || 0) : 0;
        
        // Calculate Y position (same pattern as party game's X calculation, but vertical)
        // Party game: currentX = startX + (progress / 100) * (endX - startX)
        // Vertical: currentY = startY - (progress / 100) * (startY - finishY)
        // startY is bottom (larger), finishY is top (smaller)
        const currentY = startY - (carProgress / 100) * (startY - finishY);
        
        // During predictions: only show cars in visible area (bottom 30% of track)
        if (isPredictions) {
          // If car is above visible area (in hidden top 70%), don't draw it
          if (currentY < visibleTrackStart) {
            return; // Skip drawing this car (it's in hidden area)
          }
        }
        
        // Get current terrain for particle effects
        // Segments are drawn top-to-bottom (idx 0=top, 2=bottom)
        // But backend segments are bottom-to-top (segment 0=start/bottom, 2=finish/top)
        // So we need to reverse the index
        const visualSegment = Math.floor((startY - currentY) / segmentHeight);
        const track = tracks[trackIndex];
        const segmentCount = track?.segments?.length || 3;
        // Reverse: visual segment 0 (top) = backend segment 2 (finish)
        // visual segment 2 (bottom) = backend segment 0 (start)
        const backendSegmentIndex = segmentCount - 1 - visualSegment;
        const currentTerrain = track?.segments?.[backendSegmentIndex] || "regular";
        
        // Initialize particles for this car if not exists
        if (!particlesRef.current[carId]) {
          particlesRef.current[carId] = [];
        }
        
        // Clear particles if not racing
        if (status !== "racing") {
          particlesRef.current[carId] = [];
        }
        
        // Add particles based on terrain and speed
        // Particle scale relative to car size
        const particleScale = Math.max(0.5, baseCarSize / 50); // Scale based on car size
        if (status === "racing" && carProgress > 0 && carProgress < 100) {
          const speed = carProgress / 100; // 0 to 1
          const particleChance = speed * 0.3; // More particles at higher speed
          
          if (currentTerrain === "desert" && Math.random() < particleChance) {
            // Add dust particles
            for (let i = 0; i < 2; i++) {
              particlesRef.current[carId].push(
                new Particle(
                  centerX + (Math.random() - 0.5) * baseCarSize,
                  currentY + baseCarSize * 0.6,
                  "dust",
                  particleScale
                )
              );
            }
          } else if (currentTerrain === "muddy" && Math.random() < particleChance) {
            // Add mud particles
            for (let i = 0; i < 3; i++) {
              particlesRef.current[carId].push(
                new Particle(
                  centerX + (Math.random() - 0.5) * baseCarSize,
                  currentY + baseCarSize * 0.6,
                  "mud",
                  particleScale
                )
              );
            }
          }
        }
        
        // Update and draw particles
        const particles = particlesRef.current[carId];
        for (let i = particles.length - 1; i >= 0; i--) {
          if (particles[i].update()) {
            particles[i].draw(ctx);
          } else {
            particles.splice(i, 1);
          }
        }
        
        // Car shadow (darker and more realistic) - offset scales with car size
        const shadowOffset = Math.max(1, baseCarSize * 0.06); // 6% of car size
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.ellipse(
          centerX + shadowOffset,
          currentY + baseCarSize * 0.75,
          baseCarSize * 0.55,
          baseCarSize * 0.2,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        
        // Draw car using top view image (no rotation needed - images are already correct)
        const carImage = carImagesRef.current[carId];
        if (carImage && carImage.complete && carImage.naturalWidth > 0) {
          // Image is loaded, draw it directly (no rotation)
          ctx.drawImage(
            carImage,
            centerX - baseCarSize / 2,
            currentY - baseCarSize / 2,
            baseCarSize,
            baseCarSize
          );
        } else {
          // Fallback: draw simple colored rectangle if image not loaded
          const name = car.name?.toLowerCase?.() || "";
          let carColor = "#ef4444"; // Default red
          if (name.includes("red") || name.includes("super")) carColor = "#ef4444";
          else if (name.includes("blue") || name.includes("police")) carColor = "#3b82f6";
          else if (name.includes("green") || name.includes("monster")) carColor = "#22c55e";
          else if (name.includes("yellow")) carColor = "#eab308";
          else if (name.includes("white")) carColor = "#ffffff";
          else if (name.includes("black")) carColor = "#1f2937";
          else if (trackIndex === 0) carColor = "#ef4444";
          else if (trackIndex === 1) carColor = "#3b82f6";
          else if (trackIndex === 2) carColor = "#22c55e";
          
          // Simple fallback rectangle
          ctx.fillStyle = carColor;
          drawRoundedRect(
            ctx,
            centerX - baseCarSize / 2,
            currentY - baseCarSize / 2,
            baseCarSize,
            baseCarSize * 0.7,
            baseCarSize * 0.15
          );
          ctx.fill();
          
          // Car number on fallback
          const carNumber = car.shortCode || assignment.trackNumber || trackIndex + 1;
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 2;
          ctx.font = `bold ${Math.max(8, baseCarSize * 0.2)}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.strokeText(String(carNumber), centerX, currentY);
          ctx.fillText(String(carNumber), centerX, currentY);
        }
      });

      if (isDrawing) {
        animationId = requestAnimationFrame(draw);
      }
    };

      // Start the animation loop
      isDrawing = true;
      animationId = requestAnimationFrame(draw);
    };
    
    // Start initialization
    initCanvas();
    
    // Return cleanup from useEffect
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      isDrawing = false;
      if (forceResizeHandler) {
        window.removeEventListener("resize", forceResizeHandler);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  // Derived values
  const totalPot =
    game?.totalPot ??
    Object.values(predictionCounts).reduce((sum, count) => sum + count, 0) * 100;
  const platformFee = totalPot * 0.05;
  const winnerPool = totalPot - platformFee;
  const myTotalSelections = myPredictions.length;
  const totalSelections = Object.values(predictionCounts).reduce(
    (sum, count) => sum + count,
    0
  );
  const potentialPayout =
    myTotalSelections > 0 && totalSelections > 0
      ? Math.floor(winnerPool / totalSelections) * myTotalSelections
      : 0;

  const getCarById = (carId) => {
    if (!carId || !game?.cars) return null;
    const found = game.cars.find(
      (c) =>
        c.carId?._id?.toString() === carId.toString() ||
        c.carId?.toString() === carId.toString()
    );
    return found?.carId;
  };

  if (loading && !game) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: 400 }}
      >
        <div className="text-center text-white-50">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    // Show loading state instead of "no active game" since games start immediately
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: 400 }}
      >
        <div className="text-center text-white-50">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p>Waiting for next race...</p>
          <p className="small text-white-50 mt-2">
            A new race will start automatically
          </p>
        </div>
      </div>
    );
  }

  const winnerResult = raceResults && raceResults.length > 0 ? raceResults[0] : null;
  const winnerCarIdFromResult = winnerResult?.carId?.toString();
  const winnerCarIdFromGame =
    game?.winnerCarId?._id?.toString() || game?.winnerCarId?.toString();
  const winnerCarId = winnerCarIdFromResult || winnerCarIdFromGame;
  const winnerCar = winnerCarId ? getCarById(winnerCarId) : null;

  const normalizedWinnerCarId = normalizeCarId(winnerCarId);
  const winningSelections = myPredictions.filter(
    (p) => normalizeCarId(p.predictedCarId) === normalizedWinnerCarId
  );
  const isWinner = winningSelections.length > 0;
  const totalPayout = winningSelections.reduce(
    (sum, p) => sum + (typeof p.payout === "number" ? p.payout : 0),
    0
  );
  const totalInvested = myPredictions.length * 100;

  return (
    <div
      className="d-flex flex-column"
      style={{
        // Calculate height: 100dvh minus footer height
        height: `calc(100dvh - ${footerHeight}px)`,
        width: "100dvw",
        maxWidth: "100vw",
        overflow: "hidden", // Prevent any scrolling
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <div
        className="d-flex flex-column flex-grow-1 mx-auto w-100"
        style={{
          maxWidth: "100%",
          height: "100%", // Fill parent container
          padding: "clamp(0.5rem, 2vw, 1rem)",
          borderRadius: "1rem",
          background:
            "radial-gradient(circle at top, #1e3a8a 0%, #020617 55%, #111827 100%)",
          boxShadow: "0 20px 45px rgba(15,23,42,0.75)",
          color: "#e5e7eb",
          overflow: "hidden", // Prevent content overflow
          minHeight: 0, // Allow flex shrinking
        }}
      >
        {/* Header - Fixed height, no shrink */}
        <div className="d-flex justify-content-between align-items-center flex-shrink-0" style={{ marginBottom: "clamp(0.5rem, 1.5vw, 1rem)" }}>
          <div>
            <div className="d-flex align-items-center gap-2">
              <h5 className="mb-0 fw-bold">🏁 Street Velocity</h5>
              <span className="badge bg-primary bg-gradient">
                Game&nbsp;#{game.gameNumber}
              </span>
            </div>
            <small className="text-white-50">
              Pick your champion car, watch the vertical street race live.
            </small>
          </div>
          <div className="text-end">
            {gameStatus === "predictions" && (
              <div>
                <Badge
                  bg={
                    timeRemaining > 10
                      ? "success"
                      : timeRemaining > 5
                      ? "warning"
                      : "danger"
                  }
                  className="mb-1"
                >
                  <BsClock className="me-2" />
                  {timeRemaining}s
                </Badge>
              </div>
            )}
            <div className="d-flex align-items-center justify-content-end gap-1 small">
              <BsCoin className="text-warning" />
              <span className="fw-semibold text-warning">
                {formatNumber(totalPot)} pot
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small flex-shrink-0" role="alert" style={{ marginBottom: "clamp(0.5rem, 1.5vw, 1rem)" }}>
            {error}
          </div>
        )}

        {/* Race canvas - Takes remaining space, no overflow */}
        <div
          className="position-relative flex-grow-1 w-100"
          style={{
            borderRadius: "0.9rem",
            overflow: "hidden",
            border: "2px solid rgba(148,163,184,0.35)",
            background: "#020617",
            // Use flex-grow to take remaining space
            minHeight: "200px", // Minimum height to ensure canvas can render
            height: "100%", // Fill available space
            maxHeight: "100%", // Never exceed container
            width: "100%",
            maxWidth: "100%",
            flex: "1 1 auto", // Grow and shrink as needed
          }}
        >
          <canvas
            ref={raceCanvasRef}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              background: "#1f9d55",
            }}
          />

          {raceStartCountdown > 0 && gameStatus !== "racing" && (
            <div
              className="position-absolute top-50 start-50 translate-middle text-center"
              style={{
                borderRadius: "clamp(0.5rem, 1vw, 1rem)",
                background: "rgba(15,23,42,0.92)",
                border: "2px solid #38bdf8",
                boxShadow: "0 0 35px rgba(56,189,248,0.65)",
                padding: "clamp(0.75rem, 2vw, 1.5rem) clamp(1rem, 3vw, 2rem)",
              }}
            >
              <div className="fw-semibold mb-1" style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)" }}>
                Race starting in
              </div>
              <div
                style={{
                  fontSize: "clamp(2rem, 8vw, 4rem)",
                  fontWeight: 800,
                  color: "#38bdf8",
                  textShadow: "0 0 18px rgba(56,189,248,0.9)",
                }}
              >
                {raceStartCountdown}
              </div>
            </div>
          )}

          {gameStatus === "racing" && (
            <div
              className="position-absolute top-0 start-0 m-2 rounded-pill d-flex align-items-center gap-1"
              style={{
                background: "rgba(15,23,42,0.9)",
                border: "1px solid rgba(96,165,250,0.7)",
                padding: "clamp(0.25rem, 1vw, 0.5rem) clamp(0.5rem, 2vw, 1rem)",
                fontSize: "clamp(0.7rem, 1.5vw, 0.875rem)",
              }}
            >
              <span className="text-primary">LIVE</span>
              <span className="text-white-50">Vertical street race</span>
            </div>
          )}
        </div>

        {/* Car selection strip - Fixed height, no shrink, above footer */}
        {gameStatus === "predictions" && (
          <div
            className="flex-shrink-0"
            style={{
              marginTop: "clamp(0.5rem, 1.5vw, 1rem)",
              background: "rgba(15,23,42,0.85)",
              borderRadius: "0.9rem",
              border: "1px solid rgba(148,163,184,0.35)",
              maxHeight: "clamp(150px, 25vh, 200px)", // Limit height to prevent overflow
              overflow: "hidden", // Prevent overflow
              position: "relative",
              zIndex: 10, // Ensure it's above footer (footer is usually z-1000, but this is within our container)
            }}
          >
            <div
              className="d-flex overflow-auto px-2 py-2"
              style={{ gap: "0.75rem" }}
            >
              {game.cars.map((assignment) => {
                const car = assignment.carId;
                const carId = normalizeCarId(car?._id || car);
                const count = predictionCounts[carId] || 0;

                const myCarSelections = myPredictions.filter(
                  (p) => normalizeCarId(p.predictedCarId) === carId
                );
                const mySelectionCount = myCarSelections.length;
                const hasSelections = mySelectionCount > 0;
                const hasOtherSelections =
                  myPredictions.length > 0 && !hasSelections;
                const disabled = predicting || timeRemaining <= 0;

                return (
                  <div key={carId} className="flex-shrink-0" style={{ 
                    width: "clamp(140px, 20vw, 200px)", // Responsive width: min 140px, preferred 20vw, max 200px
                    minWidth: "140px",
                    maxWidth: "200px"
                  }}>
                    <div
                      className="h-100 p-2"
                      style={{
                        borderRadius: "0.75rem",
                        cursor: disabled ? "default" : "pointer",
                        background: hasSelections
                          ? "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(147,51,234,0.35))"
                          : "radial-gradient(circle at top, rgba(15,23,42,0.9), rgba(15,23,42,0.95))",
                        border: hasSelections
                          ? "1px solid rgba(56,189,248,0.8)"
                          : "1px solid rgba(75,85,99,0.9)",
                        boxShadow: hasSelections
                          ? "0 0 18px rgba(59,130,246,0.5)"
                          : "none",
                      }}
                      onClick={() => {
                        if (disabled) return;
                        if (hasOtherSelections) {
                          setError("You can select only one car per race.");
                          return;
                        }
                        makePrediction(carId, "add");
                      }}
                    >
                      <div
                        className="mb-2 position-relative d-flex align-items-center justify-content-center"
                        style={{
                          height: 80,
                          borderRadius: "0.6rem",
                          background: car.sideViewImage
                            ? `url(${car.sideViewImage}) center/contain no-repeat`
                            : "linear-gradient(135deg,#4b5563,#1f2937)",
                          border: "1px solid rgba(148,163,184,0.4)",
                        }}
                      >
                        {!car.sideViewImage && (
                          <span style={{ fontSize: "2rem" }}>🚗</span>
                        )}
                        {hasSelections && (
                          <BsCheckCircle
                            className="position-absolute"
                            style={{
                              top: 6,
                              right: 6,
                              color: "#22c55e",
                              background: "rgba(15,23,42,0.95)",
                              borderRadius: "50%",
                            }}
                          />
                        )}
                      </div>
                      <div className="fw-semibold small mb-1 text-truncate">
                        {car.name}
                      </div>
                      <div className="text-white-50" style={{ fontSize: 11 }}>
                        Speed: {car.speedRegular}/{car.speedDesert}/
                        {car.speedMuddy}
                      </div>
                      <div className="d-flex justify-content-between align-items-center mt-1 small">
                        <div className="d-flex align-items-center gap-1 text-white-50">
                          <BsPeople />
                          <span>{count}</span>
                        </div>
                        <div className="d-flex align-items-center gap-1 text-warning">
                          <BsCoin />
                          <span>{count * 100}</span>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between align-items-center mt-2">
                        <Button
                          variant="outline-danger"
                          size="sm"
                          disabled={!hasSelections || disabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!hasSelections || disabled) return;
                            makePrediction(carId, "remove");
                          }}
                        >
                          −
                        </Button>
                        <span className="fw-semibold">{mySelectionCount}</span>
                        <Button
                          variant="outline-success"
                          size="sm"
                          disabled={disabled || hasOtherSelections}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (disabled || hasOtherSelections) return;
                            makePrediction(carId, "add");
                          }}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {myPredictions.length > 0 && (
              <div className="px-3 pb-2 small text-center text-white-50">
                <span className="text-success fw-semibold">
                  {myPredictions.length} selection
                  {myPredictions.length > 1 ? "s" : ""} placed
                </span>
                <span className="ms-2">
                  ({myPredictions.length * 100} coins used)
                </span>
                {potentialPayout > 0 && (
                  <span className="ms-2 text-warning">
                    Potential payout: {formatNumber(potentialPayout)} coins
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results section - Fixed height, no shrink */}
        {gameStatus === "finished" && raceResults && raceResults.length > 0 && (
          <div
            className="flex-shrink-0 p-3 rounded-3"
            style={{
              marginTop: "clamp(0.5rem, 1.5vw, 1rem)",
              background:
                "linear-gradient(135deg,rgba(15,23,42,0.95),rgba(15,23,42,0.9))",
              border: "1px solid rgba(148,163,184,0.6)",
              maxHeight: "clamp(150px, 25vh, 200px)", // Limit height to prevent overflow
              overflow: "auto", // Allow scrolling within results if needed
            }}
          >
            {resultPhase === 1 && (
              <div className="text-center">
                <div className="fs-5 fw-bold mb-2">🏆 Winner</div>
                <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                  {winnerCar?.sideViewImage && (
                    <img
                      src={winnerCar.sideViewImage}
                      alt="Winner Car"
                      style={{ width: "80px", height: "50px", objectFit: "contain" }}
                    />
                  )}
                  <div className="fs-4 text-warning fw-bold">
                    {winnerCar?.name || game.winnerName || "Unknown"}
                  </div>
                </div>
                {isWinner && winningSelections.length > 0 && (
                  <div className="text-success fw-semibold">
                    You have won {formatNumber(totalPayout)} coins for {winningSelections.length} selection{winningSelections.length > 1 ? "s" : ""} on winner car
                  </div>
                )}
                {!isWinner && myPredictions.length > 0 && (
                  <div className="text-danger fw-semibold">
                    You lost {formatNumber(totalInvested)} coins
                  </div>
                )}
              </div>
            )}

            {resultPhase === 0 && (
              <div className="text-center">
                {myPredictions.length > 0 ? (
                  <>
                    <div className="fs-5 fw-bold mb-2">
                      You made {myPredictions.length} selection{myPredictions.length > 1 ? "s" : ""} on car
                    </div>
                    <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                      {myPredictions[0]?.predictedCarId && (
                        <>
                          {getCarById(myPredictions[0].predictedCarId)?.sideViewImage && (
                            <img
                              src={getCarById(myPredictions[0].predictedCarId).sideViewImage}
                              alt="Car"
                              style={{ width: "60px", height: "40px", objectFit: "contain" }}
                            />
                          )}
                          <div className="fs-4 text-warning fw-bold">
                            {getCarById(myPredictions[0].predictedCarId)?.name || "Unknown Car"}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="fs-5 fw-bold mb-1">No selections made</div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}


