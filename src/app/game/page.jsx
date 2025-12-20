"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Badge, Button, Modal } from "react-bootstrap";
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
  const [userBalance, setUserBalance] = useState(0);
  const [showCarInfo, setShowCarInfo] = useState(null); // Track which car's info modal is open

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
  const resizeTimeoutRef = useRef(null); // Throttle resize
  const lastDrawTimeRef = useRef(0); // Throttle drawing
  const [footerHeight, setFooterHeight] = useState(70); // Default footer height
  
  // Performance constants
  const MAX_PARTICLES_PER_CAR = 15; // Limit particles for performance
  const DRAW_THROTTLE_MS = 16; // ~60fps max
  const RESIZE_THROTTLE_MS = 200; // Throttle resize operations

  useEffect(() => {
    latestStateRef.current = { game, raceProgress, gameStatus };
  }, [game, raceProgress, gameStatus]);

  // Footer height is 0 since this component will be used in a parent page
  // The parent page will handle navigation, so we use full height
  useEffect(() => {
    setFooterHeight(0);
  }, []);

  // Hide bottom nav when game component is active
  useEffect(() => {
    const hideBottomNav = () => {
      // Find and hide bottom nav elements
      const selectors = [
        'nav.position-fixed.bottom-0',
        'nav.d-md-none.position-fixed.bottom-0',
        '[class*="MobileBottomNav"]',
        '[class*="bottom-nav"]',
      ];
      
      let bottomNav = null;
      for (const selector of selectors) {
        bottomNav = document.querySelector(selector);
        if (bottomNav) break;
      }
      
      // Also try finding by position
      if (!bottomNav) {
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
        bottomNav.style.display = 'none';
      }
    };

    // Hide on mount
    hideBottomNav();
    
    // Also hide after a short delay to catch dynamically added navs
    const timeout1 = setTimeout(hideBottomNav, 100);
    const timeout2 = setTimeout(hideBottomNav, 500);
    
    // Use MutationObserver to hide nav if it's added later
    const observer = new MutationObserver(() => {
      hideBottomNav();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      // Show nav again when component unmounts
      const selectors = [
        'nav.position-fixed.bottom-0',
        'nav.d-md-none.position-fixed.bottom-0',
        '[class*="MobileBottomNav"]',
        '[class*="bottom-nav"]',
      ];
      
      let bottomNav = null;
      for (const selector of selectors) {
        bottomNav = document.querySelector(selector);
        if (bottomNav) break;
      }
      
      if (!bottomNav) {
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
        bottomNav.style.display = '';
      }
      
      clearTimeout(timeout1);
      clearTimeout(timeout2);
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

  // Load user balance
  useEffect(() => {
    const loadBalance = async () => {
      try {
        const response = await apiClient.get("/wallet/balance");
        setUserBalance(response.data.partyCoins || 0);
      } catch (err) {
        console.error("[Html5RaceGame] Failed to load balance", err);
      }
    };
    loadBalance();
    // Refresh balance periodically
    const interval = setInterval(loadBalance, 5000);
    return () => clearInterval(interval);
  }, []);

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
        err?.message ||
        (action === "add" ? "Failed to add selection. Please try again." : "Failed to remove selection. Please try again.");
      setError(msg);
      
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
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
      let containerWidth = rect.width || parseFloat(computedStyle.width) || 400;
      let containerHeight = rect.height || parseFloat(computedStyle.height) || 600;
      
      // Account for padding in container (clamp(0.5rem, 2vw, 1rem) on each side)
      const padding = Math.max(16, Math.min(containerWidth * 0.02, 16)); // ~1rem max
      containerWidth = Math.max(containerWidth - padding * 2, 300);
      containerHeight = Math.max(containerHeight - padding * 2, 360);
      
      // Target aspect ratio: height should be more than width (vertical game)
      // Minimum aspect ratio: 1.2:1 (height is 20% more than width)
      // Ideal aspect ratio: 1.6:1 for vertical racing
      const minAspectRatio = 1.2; // Height must be at least 1.2x width
      const idealAspectRatio = 1.6; // Ideal ratio for vertical racing
      
      let canvasWidth, canvasHeight;
      
      // Calculate optimal size maintaining vertical aspect ratio
      if (containerHeight / containerWidth >= minAspectRatio) {
        // Container is tall enough, use full available width
        canvasWidth = containerWidth;
        canvasHeight = containerHeight;
      } else {
        // Container is too wide/square, maintain aspect ratio with side spacing
        // Calculate width based on height to maintain aspect ratio
        canvasHeight = containerHeight;
        canvasWidth = containerHeight / idealAspectRatio;
        
        // Don't exceed container width
        if (canvasWidth > containerWidth) {
          canvasWidth = containerWidth;
          canvasHeight = canvasWidth * idealAspectRatio;
        }
      }
      
      // Ensure minimum dimensions
      canvasWidth = Math.max(canvasWidth, 300);
      canvasHeight = Math.max(canvasHeight, 360); // 300 * 1.2 minimum
      
      // Ensure height is always more than width (critical for vertical game)
      if (canvasHeight <= canvasWidth) {
        canvasHeight = canvasWidth * minAspectRatio;
      }
      
      const dpr = window.devicePixelRatio || 1;
      
      if (canvasWidth > 0 && canvasHeight > 0) {
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        canvas.style.width = `${canvasWidth}px`;
        canvas.style.height = `${canvasHeight}px`;
        
        // Center canvas if container is wider than needed
        if (containerWidth > canvasWidth) {
          canvas.style.marginLeft = 'auto';
          canvas.style.marginRight = 'auto';
        } else {
          canvas.style.marginLeft = '0';
          canvas.style.marginRight = '0';
        }
        
        // Reset transform and scale for high DPI
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
    };

      // Throttled resize function for better performance
      const throttledResize = () => {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = setTimeout(() => {
          resize();
        }, RESIZE_THROTTLE_MS);
      };
      
      // Force initial resize
      const forceResize = () => {
        resize();
        // Try again after a short delay
        setTimeout(resize, 100);
        setTimeout(resize, 500);
      };
      
      forceResizeHandler = throttledResize;
      forceResize();
      window.addEventListener("resize", throttledResize);
      
      // Also resize when container size changes (throttled)
      if (canvas.parentElement) {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              throttledResize();
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
      
      // Throttle drawing to ~60fps for better performance
      const now = performance.now();
      const timeSinceLastDraw = now - lastDrawTimeRef.current;
      if (timeSinceLastDraw < DRAW_THROTTLE_MS && isDrawing) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastDrawTimeRef.current = now;
      
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

        // Draw segments bottom-to-top to match backend order
        // Backend: segments[0] = first 100m (start/bottom), segments[2] = third 100m (finish/top)
        // Visual: Draw segments[0] at bottom, segments[2] at top
        segments.forEach((terrain, idx) => {
          // Reverse visual order: idx 0 (backend segment 0) at bottom, idx 2 (backend segment 2) at top
          const visualIdx = segments.length - 1 - idx;
          const y = trackTop + visualIdx * segmentHeight;
          const segmentBottom = y + segmentHeight;
          
          // Use terrain directly (no reversing needed now)
          const actualTerrain = terrain;
          
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
      // Increased by 30% for better visibility
      const cars = g?.cars || [];
      const baseCarSize = Math.min(
        laneWidth * 0.7, // 70% of lane width
        segmentHeight * 0.35, // 35% of segment height
        height * 0.08 // Max 8% of canvas height to prevent oversized cars
      ) * 1.3; // Increase by 30%

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
        // Segments are now drawn bottom-to-top to match backend order
        // Backend: segments[0] = start/bottom, segments[2] = finish/top
        // Car starts at bottom (startY) and moves to top (finishY)
        // Calculate which segment the car is in (0 = bottom/start, 2 = top/finish)
        const distanceFromStart = startY - currentY; // 0 at start, trackHeight at finish
        const segmentIndex = Math.floor(distanceFromStart / segmentHeight);
        // Clamp to valid segment range
        const track = tracks[trackIndex];
        const segmentCount = track?.segments?.length || 3;
        const clampedSegmentIndex = Math.max(0, Math.min(segmentCount - 1, segmentIndex));
        const currentTerrain = track?.segments?.[clampedSegmentIndex] || "regular";
        
        // Initialize particles for this car if not exists
        if (!particlesRef.current[carId]) {
          particlesRef.current[carId] = [];
        }
        
        // Clear particles if not racing
        if (status !== "racing") {
          particlesRef.current[carId] = [];
        }
        
        // Add particles based on terrain and speed (optimized with limits)
        // Particle scale relative to car size
        const particleScale = Math.max(0.5, baseCarSize / 50); // Scale based on car size
        const particles = particlesRef.current[carId];
        
        // Limit total particles for performance
        if (particles.length < MAX_PARTICLES_PER_CAR && status === "racing" && carProgress > 0 && carProgress < 100) {
          const speed = carProgress / 100; // 0 to 1
          const particleChance = speed * 0.25; // Reduced chance for better performance
          
          if (currentTerrain === "desert" && Math.random() < particleChance) {
            // Add dust particles (limit to 1-2 per frame)
            const particlesToAdd = Math.min(2, MAX_PARTICLES_PER_CAR - particles.length);
            for (let i = 0; i < particlesToAdd; i++) {
              particles.push(
                new Particle(
                  centerX + (Math.random() - 0.5) * baseCarSize,
                  currentY + baseCarSize * 0.6,
                  "dust",
                  particleScale
                )
              );
            }
          } else if (currentTerrain === "muddy" && Math.random() < particleChance) {
            // Add mud particles (limit to 2-3 per frame)
            const particlesToAdd = Math.min(3, MAX_PARTICLES_PER_CAR - particles.length);
            for (let i = 0; i < particlesToAdd; i++) {
              particles.push(
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
        
        // Update and draw particles (optimized cleanup)
        for (let i = particles.length - 1; i >= 0; i--) {
          if (particles[i].update()) {
            particles[i].draw(ctx);
          } else {
            particles.splice(i, 1);
          }
        }
        
        // Cleanup old particles if too many (safety check)
        if (particles.length > MAX_PARTICLES_PER_CAR * 1.5) {
          particles.splice(0, particles.length - MAX_PARTICLES_PER_CAR);
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
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
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
      // Clear particles and obstacles to prevent memory leaks
      particlesRef.current = {};
      obstaclesRef.current = {};
    };
  }, []);

  // Derived values (memoized for performance)
  const totalPot = useMemo(() => {
    return game?.totalPot ??
      Object.values(predictionCounts).reduce((sum, count) => sum + count, 0) * 100;
  }, [game?.totalPot, predictionCounts]);
  
  const platformFee = useMemo(() => totalPot * 0.05, [totalPot]);
  const winnerPool = useMemo(() => totalPot - platformFee, [totalPot, platformFee]);
  const myTotalSelections = useMemo(() => myPredictions.length, [myPredictions.length]);
  const totalSelections = useMemo(() => {
    return Object.values(predictionCounts).reduce((sum, count) => sum + count, 0);
  }, [predictionCounts]);
  
  const potentialPayout = useMemo(() => {
    return myTotalSelections > 0 && totalSelections > 0
      ? Math.floor(winnerPool / totalSelections) * myTotalSelections
      : 0;
  }, [myTotalSelections, totalSelections, winnerPool]);

  const getCarById = useCallback((carId) => {
    if (!carId || !game?.cars) return null;
    const found = game.cars.find(
      (c) =>
        c.carId?._id?.toString() === carId.toString() ||
        c.carId?.toString() === carId.toString()
    );
    return found?.carId;
  }, [game?.cars]);

  if (loading && !game) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: 400 }}
      >
        <div className="text-center" style={{ color: "var(--text-muted, #a8b3d0)" }}>
          <div className="spinner-border mb-3" style={{ color: "var(--accent-secondary, #00f5ff)" }} role="status" />
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
        <div className="text-center" style={{ color: "var(--text-muted, #a8b3d0)" }}>
          <div className="spinner-border mb-3" style={{ color: "var(--accent-secondary, #00f5ff)" }} role="status" />
          <p>Waiting for next race...</p>
          <p className="small mt-2" style={{ color: "var(--text-dim, #7a85a3)" }}>
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
      className="position-relative"
      style={{
        // Full height/width to adapt to parent container
        height: "100%",
        width: "100%",
        minHeight: "400px", // Minimum height for proper display
        overflow: "hidden", // Prevent any scrolling
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        background: "var(--bg-darker, #050810)",
        fontFamily: "var(--font-space-grotesk), 'Poppins', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Responsive canvas container - maintains vertical aspect ratio */}
      <div
        className="position-absolute w-100 h-100 d-flex align-items-center justify-content-center"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
          padding: "clamp(0.5rem, 2vw, 1rem)",
          boxSizing: "border-box",
        }}
      >
        <canvas
          ref={raceCanvasRef}
          style={{
            display: "block",
            background: "#1f9d55",
          }}
        />
      </div>

      {/* Minimal header overlay - top right */}
      <div
        className="position-absolute glass-card"
        style={{
          top: "clamp(0.5rem, 1vw, 1rem)",
          right: "clamp(0.5rem, 1vw, 1rem)",
          zIndex: 10,
          borderRadius: "0.75rem",
          padding: "clamp(0.5rem, 1vw, 0.75rem)",
        }}
      >
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-1">
            <span 
              className="badge small"
              style={{
                background: "linear-gradient(135deg, var(--accent, #ca0000) 0%, var(--accent-tertiary, #ce0000) 100%)",
                color: "var(--text-primary, #ffffff)",
                boxShadow: "0 0 10px var(--glow-pink, rgba(200, 0, 100, 0.4))",
              }}
            >
              Game&nbsp;#{game.gameNumber}
            </span>
          </div>
          {gameStatus === "predictions" && (
            <Badge
              className="small"
              style={{
                background: timeRemaining > 10
                  ? "rgba(0, 245, 255, 0.2)"
                  : timeRemaining > 5
                  ? "rgba(255, 193, 7, 0.2)"
                  : "rgba(202, 0, 0, 0.2)",
                color: timeRemaining > 10
                  ? "var(--accent-secondary, #00f5ff)"
                  : timeRemaining > 5
                  ? "#ffc107"
                  : "var(--accent, #ca0000)",
                border: `1px solid ${timeRemaining > 10
                  ? "var(--accent-secondary, #00f5ff)"
                  : timeRemaining > 5
                  ? "#ffc107"
                  : "var(--accent, #ca0000)"}`,
              }}
            >
              <BsClock className="me-1" />
              {timeRemaining}s
            </Badge>
          )}
          <div className="d-flex align-items-center gap-1 small">
            <BsCoin style={{ color: "var(--accent-secondary, #00f5ff)" }} />
            <span className="fw-semibold" style={{ color: "var(--accent-secondary, #00f5ff)" }}>
              {formatNumber(totalPot)}
            </span>
          </div>
        </div>
      </div>

      {/* Error toast - top center */}
      {error && (
        <div
          className="position-absolute"
          style={{
            top: "clamp(0.5rem, 1vw, 1rem)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            maxWidth: "90%",
          }}
        >
          <div 
            className="alert py-2 small mb-0" 
            role="alert"
            style={{
              background: "rgba(202, 0, 0, 0.2)",
              border: "1px solid var(--accent, #ca0000)",
              color: "var(--text-primary, #ffffff)",
              borderRadius: "0.5rem",
            }}
          >
            {error}
          </div>
        </div>
      )}

      {/* Countdown Modal - Consistent with selection and results */}
      <Modal
        show={raceStartCountdown > 0 && gameStatus !== "racing"}
        onHide={() => {}}
        backdrop="static"
        keyboard={false}
        centered
        size="md"
        contentClassName="glass-card"
        style={{ border: "1px solid rgba(255, 255, 255, 0.1)" }}
      >
        <Modal.Header className="glass-card" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <Modal.Title className="w-100 text-center" style={{ color: "var(--text-primary, #ffffff)" }}>
            <div className="fw-semibold mb-2" style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)" }}>
              Race Starting In
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center" style={{ background: "transparent" }}>
          <div
            style={{
              fontSize: "clamp(3rem, 12vw, 6rem)",
              fontWeight: 800,
              color: "var(--accent-secondary, #00f5ff)",
              textShadow: "0 0 30px var(--glow-cyan, rgba(0, 245, 255, 0.4))",
              lineHeight: 1,
              padding: "clamp(1rem, 3vw, 2rem) 0",
            }}
          >
            {raceStartCountdown}
          </div>
        </Modal.Body>
      </Modal>

      {/* Live indicator */}
      {gameStatus === "racing" && (
        <div
          className="position-absolute top-0 start-0 m-2 rounded-pill d-flex align-items-center gap-1 glass-card"
          style={{
            zIndex: 10,
            border: "1px solid var(--accent-secondary, #00f5ff)",
            padding: "clamp(0.25rem, 1vw, 0.5rem) clamp(0.5rem, 2vw, 1rem)",
            fontSize: "clamp(0.7rem, 1.5vw, 0.875rem)",
            boxShadow: "0 0 20px var(--glow-cyan, rgba(0, 245, 255, 0.4))",
          }}
        >
          <span className="fw-bold" style={{ color: "var(--accent-secondary, #00f5ff)" }}>LIVE</span>
          <span style={{ color: "var(--text-muted, #a8b3d0)" }}>Vertical street race</span>
        </div>
      )}

      {/* Selection Modal - Hide during countdown */}
      <Modal
        show={gameStatus === "predictions" && raceStartCountdown === 0}
        onHide={() => {}}
        backdrop="static"
        keyboard={false}
        centered
        size="lg"
        contentClassName="glass-card"
        style={{ border: "1px solid rgba(255, 255, 255, 0.1)" }}
      >
        {/* Header Stats Bar */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2"
          style={{
            background: "rgba(10, 14, 26, 0.8)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            fontSize: "0.875rem",
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-1">
              <BsPeople style={{ color: "var(--text-muted, #a8b3d0)" }} />
              <span style={{ color: "var(--text-primary, #ffffff)" }}>{totalSelections}</span>
            </div>
            <div className="d-flex align-items-center gap-1">
              <BsCoin style={{ color: "#ffd700" }} />
              <span style={{ color: "var(--text-primary, #ffffff)" }}>{formatNumber(totalPot)}</span>
            </div>
            <div style={{ color: "var(--accent-secondary, #00f5ff)" }}>
              {timeRemaining}s
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="d-flex align-items-center gap-1">
              <BsCoin style={{ color: "#ffd700" }} />
              <span style={{ color: "var(--text-primary, #ffffff)" }}>{formatNumber(userBalance)}</span>
            </div>
            <Button
              size="sm"
              variant="outline-light"
              style={{
                minWidth: "30px",
                padding: "0.25rem 0.5rem",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              +
            </Button>
          </div>
        </div>

        {/* Road Preview Section */}
        <div className="px-3 py-2" style={{ background: "rgba(15, 23, 42, 0.5)" }}>
          <div className="d-flex gap-2 align-items-center">
            {(game.tracks || [
              { segments: ["regular", "regular", "regular"] },
              { segments: ["desert", "desert", "desert"] },
              { segments: ["muddy", "muddy", "muddy"] },
            ]).map((track, idx) => {
              const segments = track.segments || ["regular", "regular", "regular"];
              const terrainNames = {
                regular: "Highway",
                desert: "Desert",
                muddy: "Potholes",
              };
              // Show middle segment (index 1) terrain
              const middleTerrain = segments[1] || segments[Math.floor(segments.length / 2)] || "regular";
              const isActive = idx === 1; // Middle track is active
              
              return (
                <div key={idx} className="flex-grow-1 position-relative">
                  <div
                    className="text-center mb-1 small fw-bold"
                    style={{
                      color: isActive ? "#ffd700" : "var(--text-muted, #a8b3d0)",
                      fontSize: "0.75rem",
                    }}
                  >
                    {isActive ? (
                      <>
                        <span className="me-1">⛰️</span>
                        {terrainNames[middleTerrain] || "???"}
                        <span className="ms-1">→</span>
                      </>
                    ) : (
                      "???"
                    )}
                  </div>
                  <div
                    style={{
                      height: "40px",
                      background: middleTerrain === "regular" 
                        ? "#2a2d35" 
                        : middleTerrain === "desert"
                        ? "#d4a574"
                        : "#6b4423",
                      borderRadius: "0.25rem",
                      border: isActive ? "2px solid #ffd700" : "1px solid rgba(255, 255, 255, 0.1)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {middleTerrain === "muddy" && (
                      <>
                        {/* Potholes */}
                        <div
                          style={{
                            position: "absolute",
                            width: "8px",
                            height: "8px",
                            background: "#3a2410",
                            borderRadius: "50%",
                            top: "50%",
                            left: "30%",
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            width: "6px",
                            height: "6px",
                            background: "#3a2410",
                            borderRadius: "50%",
                            top: "50%",
                            left: "70%",
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                        {isActive && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: "2px",
                              background: "var(--accent, #ca0000)",
                            }}
                          />
                        )}
                      </>
                    )}
                    {middleTerrain === "regular" && (
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: 0,
                          right: 0,
                          height: "1px",
                          background: "repeating-linear-gradient(to right, #fff 0, #fff 10px, transparent 10px, transparent 20px)",
                          transform: "translateY(-50%)",
                        }}
                      />
                    )}
                    {middleTerrain === "desert" && (
                      <>
                        <div
                          style={{
                            position: "absolute",
                            width: "4px",
                            height: "4px",
                            background: "#c49a5f",
                            borderRadius: "50%",
                            top: "20%",
                            left: "25%",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            width: "3px",
                            height: "3px",
                            background: "#c49a5f",
                            borderRadius: "50%",
                            top: "60%",
                            left: "60%",
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Modal.Body 
          style={{ background: "transparent", padding: "1rem" }}
          onClick={() => setShowCarInfo(null)}
        >
          <div className="row g-2">
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

                // Calculate potential payout ratio (multiplier)
                // If this car wins: payout = winnerPool / totalSelections per selection
                // Ratio = payout per selection / cost per selection (100 coins)
                const carTotalSelections = count;
                const payoutPerSelection = totalSelections > 0
                  ? winnerPool / totalSelections
                  : 0;
                const currentRatio = payoutPerSelection > 0
                  ? (payoutPerSelection / 100).toFixed(1)
                  : "0.0";
                // Max ratio if only this car had selections (theoretical max)
                const maxRatio = carTotalSelections > 0 && totalSelections > 0
                  ? (winnerPool / (carTotalSelections * 100)).toFixed(1)
                  : currentRatio;

                return (
                  <div key={carId} className="col-4">
                    <div
                      className="h-100 p-2 position-relative"
                      style={{
                        borderRadius: "0.75rem",
                        background: "rgba(20, 27, 45, 0.6)",
                        border: hasSelections
                          ? "2px solid var(--accent-secondary, #00f5ff)"
                          : "1px solid rgba(255, 255, 255, 0.1)",
                        boxShadow: hasSelections
                          ? "0 0 15px var(--glow-cyan, rgba(0, 245, 255, 0.4))"
                          : "none",
                      }}
                    >
                      {/* Rating and Info Button */}
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <span
                          className="small fw-bold"
                          style={{ color: "#ffd700", fontSize: "0.7rem" }}
                        >
                          {currentRatio}/{maxRatio}
                        </span>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0"
                          style={{
                            minWidth: "20px",
                            height: "20px",
                            color: "var(--text-muted, #a8b3d0)",
                            textDecoration: "none",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCarInfo(showCarInfo === carId ? null : carId);
                          }}
                        >
                          ?
                        </Button>
                      </div>

                      {/* Car Image */}
                      <div
                        className="mb-2 position-relative d-flex align-items-center justify-content-center rounded-2"
                        style={{
                          height: "80px",
                          borderRadius: "0.5rem",
                          background: car.sideViewImage
                            ? `url(${car.sideViewImage}) center/contain no-repeat`
                            : "linear-gradient(135deg,#4b5563,#1f2937)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        {!car.sideViewImage && (
                          <span style={{ fontSize: "2rem" }}>🚗</span>
                        )}
                        {hasSelections && (
                          <BsCheckCircle
                            className="position-absolute"
                            style={{
                              top: 4,
                              right: 4,
                              color: "#22c55e",
                              background: "rgba(15,23,42,0.95)",
                              borderRadius: "50%",
                            }}
                          />
                        )}
                      </div>

                      {/* Car Name */}
                      <div
                        className="fw-semibold small mb-1 text-truncate text-center"
                        style={{ color: "var(--text-primary, #ffffff)", fontSize: "0.75rem" }}
                      >
                        {car.name}
                      </div>

                      {/* Cost */}
                      <div className="d-flex align-items-center justify-content-center gap-1 mb-2">
                        <BsCoin style={{ color: "#ffd700", fontSize: "0.75rem" }} />
                        <span style={{ color: "var(--text-primary, #ffffff)", fontSize: "0.75rem" }}>
                          {formatNumber(count * 100)}
                        </span>
                      </div>

                      {/* Select Button */}
                      <Button
                        variant={hasSelections ? "primary" : "outline-light"}
                        size="sm"
                        className="w-100"
                        disabled={disabled || hasOtherSelections}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (disabled || hasOtherSelections) return;
                          if (hasSelections) {
                            makePrediction(carId, "remove");
                          } else {
                            makePrediction(carId, "add");
                          }
                        }}
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.25rem",
                          background: hasSelections
                            ? "linear-gradient(135deg, var(--accent, #ca0000) 0%, var(--accent-tertiary, #ce0000) 100%)"
                            : "transparent",
                          border: hasSelections
                            ? "none"
                            : "1px solid rgba(255, 255, 255, 0.2)",
                        }}
                      >
                        <BsCoin style={{ color: "#ffd700", fontSize: "0.7rem" }} className="me-1" />
                        {hasSelections ? mySelectionCount : 0}
                      </Button>

                      {/* Car Info Modal */}
                      {showCarInfo === carId && (
                        <div
                          className="position-absolute top-0 start-0 end-0 p-2 rounded"
                          style={{
                            background: "rgba(10, 14, 26, 0.95)",
                            border: "1px solid var(--accent-secondary, #00f5ff)",
                            zIndex: 10,
                            backdropFilter: "blur(10px)",
                            boxShadow: "0 0 20px var(--glow-cyan, rgba(0, 245, 255, 0.4))",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="small mb-2 fw-bold" style={{ color: "var(--text-primary, #ffffff)" }}>
                            Car Speeds:
                          </div>
                          <div className="small mb-2" style={{ color: "var(--text-muted, #a8b3d0)" }}>
                            <div>Highway: {car.speedRegular} km/h</div>
                            <div>Desert: {car.speedDesert} km/h</div>
                            <div>Muddy: {car.speedMuddy} km/h</div>
                          </div>
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0"
                            style={{ color: "var(--accent-secondary, #00f5ff)", fontSize: "0.7rem" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowCarInfo(null);
                            }}
                          >
                            Close
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer with Counter and Play Button */}
            <div
              className="d-flex align-items-center justify-content-between px-3 py-2 mt-3"
              style={{
                background: "rgba(10, 14, 26, 0.8)",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "0 0 0.5rem 0.5rem",
              }}
            >
              {/* Counter */}
              <div className="d-flex align-items-center gap-2">
                <Button
                  variant="outline-light"
                  size="sm"
                  disabled={myPredictions.length === 0 || disabled}
                  onClick={() => {
                    if (myPredictions.length === 0 || disabled) return;
                    const selectedCarId = myPredictions[0]?.predictedCarId;
                    if (selectedCarId) {
                      makePrediction(normalizeCarId(selectedCarId), "remove");
                    }
                  }}
                  style={{
                    minWidth: "35px",
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  −
                </Button>
                <div className="d-flex align-items-center gap-1 px-2">
                  <BsCoin style={{ color: "#ffd700" }} />
                  <span style={{ color: "var(--text-primary, #ffffff)" }}>
                    {myPredictions.length * 100}
                  </span>
                </div>
                <Button
                  variant="outline-light"
                  size="sm"
                  disabled={disabled || myPredictions.length === 0 || (myPredictions.length * 100 + 100) > userBalance}
                  onClick={() => {
                    if (disabled || myPredictions.length === 0) return;
                    const selectedCarId = myPredictions[0]?.predictedCarId;
                    if (selectedCarId) {
                      makePrediction(normalizeCarId(selectedCarId), "add");
                    }
                  }}
                  style={{
                    minWidth: "35px",
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  +
                </Button>
              </div>

              {/* Play Button (disabled - just visual) */}
              <Button
                variant="primary"
                size="lg"
                disabled
                style={{
                  background: "linear-gradient(135deg, var(--accent-secondary, #00f5ff) 0%, #0099cc 100%)",
                  border: "none",
                  padding: "0.5rem 2rem",
                  fontSize: "1rem",
                  fontWeight: 600,
                }}
              >
                Play
              </Button>
            </div>
        </Modal.Body>
      </Modal>

      {/* Results Modal */}
      <Modal
        show={gameStatus === "finished" && raceResults && raceResults.length > 0}
        onHide={() => {}}
        backdrop="static"
        keyboard={false}
        centered
        size="md"
        contentClassName="glass-card"
        style={{ border: "1px solid rgba(255, 255, 255, 0.1)" }}
      >
        <Modal.Header className="glass-card" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <Modal.Title style={{ color: "var(--text-primary, #ffffff)" }}>
            <div className="d-flex align-items-center gap-2">
              <span>🏆</span>
              <span>Race Results</span>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center" style={{ background: "transparent" }}>
          {resultPhase === 1 && (
            <>
              <div className="fs-5 fw-bold mb-3" style={{ color: "var(--text-primary, #ffffff)" }}>Winner</div>
              <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
                {winnerCar?.sideViewImage && (
                  <img
                    src={winnerCar.sideViewImage}
                    alt="Winner Car"
                    style={{ width: "100px", height: "60px", objectFit: "contain" }}
                  />
                )}
                <div className="fs-3 fw-bold" style={{ color: "var(--accent-secondary, #00f5ff)" }}>
                  {winnerCar?.name || game.winnerName || "Unknown"}
                </div>
              </div>
              {isWinner && winningSelections.length > 0 && (
                <div className="fw-semibold fs-5 mb-2" style={{ color: "var(--accent-secondary, #00f5ff)" }}>
                  🎉 You won {formatNumber(totalPayout)} coins!
                </div>
              )}
              {!isWinner && myPredictions.length > 0 && (
                <div className="fw-semibold fs-5 mb-2" style={{ color: "var(--accent, #ca0000)" }}>
                  You lost {formatNumber(totalInvested)} coins
                </div>
              )}
              {resultCountdown > 0 && (
                <div className="small mt-3" style={{ color: "var(--text-muted, #a8b3d0)" }}>
                  Next race in {resultCountdown}s
                </div>
              )}
            </>
          )}

          {resultPhase === 0 && (
            <>
              {myPredictions.length > 0 ? (
                <>
                  <div className="fs-5 fw-bold mb-3" style={{ color: "var(--text-primary, #ffffff)" }}>
                    Your Selections
                  </div>
                  <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
                    {myPredictions[0]?.predictedCarId && (
                      <>
                        {getCarById(myPredictions[0].predictedCarId)?.sideViewImage && (
                          <img
                            src={getCarById(myPredictions[0].predictedCarId).sideViewImage}
                            alt="Car"
                            style={{ width: "80px", height: "50px", objectFit: "contain" }}
                          />
                        )}
                        <div className="fs-4 fw-bold" style={{ color: "var(--accent-secondary, #00f5ff)" }}>
                          {getCarById(myPredictions[0].predictedCarId)?.name || "Unknown Car"}
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ color: "var(--text-muted, #a8b3d0)" }}>
                    {myPredictions.length} selection{myPredictions.length > 1 ? "s" : ""} placed
                  </div>
                </>
              ) : (
                <div className="fs-5 fw-bold mb-1" style={{ color: "var(--text-primary, #ffffff)" }}>No selections made</div>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}


