const path = require('node:path');
const http = require('node:http');

const compression = require('compression');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

dotenv.config({
  path: path.join(__dirname, '.env'),
});

const createUserRouter = require('./routes/users');
const createPartyRouter = require('./routes/party');
const createWalletRouter = require('./routes/wallet');
const createGiftRouter = require('./routes/gifts');
const createFriendsRouter = require('./routes/friends');
const createMessagesRouter = require('./routes/messages');
const gamesRouter = require('./routes/games');
const GameEngine = require('./services/gameEngine');
const Party = require('./schemas/party');

// Declare gameEngine at module level so it's accessible to socket handlers
let gameEngine = null;

const PORT = Number(process.env.PORT) || 5030;
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const { JWT_SECRET = 'change-me' } = process.env;

if (!MONGO_URI) {
  throw new Error('Missing MONGODB_URI (or MONGO_URI) in backend/.env');
}

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'https://darkunde.in',
  'https://api.darkunde.in',
  'https://app.darkunde.in',
  'https://app.darkunde.in/api',
  'https://app.darkunde.in/api/users',
  'https://app.darkunde.in/api/parties',
  'https://app.darkunde.in/api/wallet',
  'https://app.darkunde.in/api/gifts',
  'https://app.darkunde.in/api/friends',
  'https://app.darkunde.in/api/messages',
  'https://app.darkunde.in/api/games',
  'https://app.darkunde.in/api/admin',
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

const app = express();
app.set('trust proxy', 1);

// Configure Helmet to allow cross-origin images
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // For mobile apps, allow any origin from local network
      if (origin.includes('192.168.') || origin.includes('10.0.2.2') || origin.includes('localhost')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true, // Allow Engine.IO v3 clients
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.use((socket, next) => {
  const authHeader = socket.handshake.headers?.authorization;
  const token = socket.handshake.auth?.token || (authHeader && authHeader.split(' ')[1]);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.data.user = payload;
    next();
  } catch (error) {
    next(new Error('Invalid auth token'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] ✅ Client connected: ${socket.id}`);
  
  // Auto-join user's personal room for notifications
  const userId = socket.data.user?.sub;
  if (userId) {
    socket.join(`user:${userId}`);
    console.log(`[Socket.IO] User ${userId} auto-joined personal room`);
  }
  
  // Track client in game engine
  if (gameEngine) {
    gameEngine.addClient(socket.id);
  }
  
  // Game prediction count updates
  socket.on('game:get_counts', async (data) => {
    try {
      const { gameId } = data;
      if (gameId && gameEngine) {
        const counts = await gameEngine.getPredictionCounts(gameId);
        socket.emit('game:prediction_counts', { gameId, counts });
      }
    } catch (error) {
      console.error('[Socket.IO] Error getting prediction counts:', error);
    }
  });
  
  socket.on('party:join', async (data) => {
    const { partyId } = data;
    if (partyId) {
      socket.join(`party:${partyId}`);
      console.log(`[Socket.IO] User ${socket.id} joined party room: party:${partyId}`);
      
      // Send current party stream state to the joining participant
      try {
        const party = await Party.findById(partyId);
        if (party) {
          const userId = socket.data.user?.sub;
          const hostId = party.hostId?.toString();
          
          console.log(`[Socket.IO] Sending stream state to ${userId} - mic:${party.hostMicEnabled}, cam:${party.hostCameraEnabled}`);
          
          // Send party state to the newly joined socket (not a stream start event)
          socket.emit('party:stream-state', {
            partyId,
            hostMicEnabled: party.hostMicEnabled || false,
            hostCameraEnabled: party.hostCameraEnabled || false,
            hostId: hostId,
          });
        }
      } catch (error) {
        console.error('[Socket.IO] Error checking party stream state:', error);
      }
    }
  });

  socket.on('party:leave', (data) => {
    const { partyId } = data;
    if (partyId) {
      socket.leave(`party:${partyId}`);
      console.log(`[Socket.IO] User ${socket.id} left party room: party:${partyId}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] ❌ Client disconnected: ${socket.id}`);
    // Remove client from game engine
    if (gameEngine) {
      gameEngine.removeClient(socket.id);
    }
  });

  // WebRTC Signaling Events (simple-peer compatible)
  socket.on('webrtc:offer', (data) => {
    const { partyId, targetUserId, offer } = data;
    const fromUserId = socket.data.user?.sub || socket.id;
    console.log(`[WebRTC] Offer from ${fromUserId} to ${targetUserId} in party ${partyId}`);
    
    // Send to specific target user in the party room
    io.to(`party:${partyId}`).emit('webrtc:offer', {
      partyId,
      fromUserId,
      targetUserId,
      offer,
    });
  });

  socket.on('webrtc:answer', (data) => {
    const { partyId, targetUserId, answer } = data;
    const fromUserId = socket.data.user?.sub || socket.id;
    console.log(`[WebRTC] Answer from ${fromUserId} to ${targetUserId} in party ${partyId}`);
    
    // Send to specific target user in the party room
    io.to(`party:${partyId}`).emit('webrtc:answer', {
      partyId,
      fromUserId,
      targetUserId,
      answer,
    });
  });

  socket.on('webrtc:ice-candidate', (data) => {
    const { partyId, targetUserId, candidate } = data;
    const fromUserId = socket.data.user?.sub || socket.id;
    
    // Send to specific target user in the party room
    io.to(`party:${partyId}`).emit('webrtc:ice-candidate', {
      partyId,
      fromUserId,
      targetUserId,
      candidate,
    });
  });

  // Simple-peer signal handler (handles all signal types)
  socket.on('webrtc:signal', (data) => {
    const { partyId, targetUserId, signal } = data;
    const fromUserId = socket.data.user?.sub || socket.id;
    
    // Forward signal to target user
    io.to(`party:${partyId}`).emit('webrtc:signal', {
      partyId,
      fromUserId,
      targetUserId,
      signal,
    });
  });

  socket.on('webrtc:host-stream-started', (data) => {
    const { partyId } = data;
    socket.to(`party:${partyId}`).emit('webrtc:host-stream-started', {
      ...data,
      hostId: socket.data.user?.sub || socket.id,
    });
  });

  socket.on('webrtc:host-stream-stopped', (data) => {
    const { partyId } = data;
    socket.to(`party:${partyId}`).emit('webrtc:host-stream-stopped', data);
  });

  socket.on('webrtc:host-mic-toggled', (data) => {
    const { partyId } = data;
    socket.to(`party:${partyId}`).emit('webrtc:host-mic-toggled', data);
  });

  socket.on('webrtc:host-camera-toggled', (data) => {
    const { partyId } = data;
    socket.to(`party:${partyId}`).emit('webrtc:host-camera-toggled', data);
  });

  socket.on('webrtc:request-stream', (data) => {
    const { partyId, hostId } = data;
    const fromUserId = socket.data.user?.sub || socket.id;
    console.log(`[WebRTC] 📞 Stream request from ${fromUserId} to host ${hostId} in party ${partyId}`);
    
    // Notify the host that a participant wants to receive the stream
    socket.to(`party:${partyId}`).emit('webrtc:stream-requested', {
      partyId,
      fromUserId,
      requestedBy: fromUserId,
    });
    console.log(`[WebRTC] ✅ Broadcasted stream-requested to party room (except sender)`);
  });

  // Friend-to-friend video call events
  socket.on('friend:call:initiate', async (data) => {
    const { friendId } = data;
    const fromUserId = socket.data.user?.sub;
    
    if (!fromUserId) {
      socket.emit('friend:call:error', { error: 'Not authenticated' });
      return;
    }

    // Verify they are friends
    try {
      const User = require('./schemas/users');
      const user = await User.findById(fromUserId);
      const friend = await User.findById(friendId);
      
      if (!user.social?.friends?.some((id) => id.toString() === friendId)) {
        socket.emit('friend:call:error', { error: 'Can only call friends' });
        return;
      }

      // Check if user is blocked
      if (user.social?.blockedUsers?.some((id) => id.toString() === friendId)) {
        socket.emit('friend:call:error', { error: 'Cannot call blocked user' });
        return;
      }

      // Check if you are blocked by this user
      if (friend?.social?.blockedUsers?.some((id) => id.toString() === user._id.toString())) {
        socket.emit('friend:call:error', { error: 'User has blocked you' });
        return;
      }

      // Find friend's socket (they should be in a room with their userId)
      io.to(`user:${friendId}`).emit('friend:call:incoming', {
        fromUserId,
        friendId,
      });
    } catch (error) {
      console.error('[Socket.IO] Error initiating friend call:', error);
      socket.emit('friend:call:error', { error: 'Failed to initiate call' });
    }
  });

  socket.on('friend:call:accept', (data) => {
    const { friendId } = data;
    const fromUserId = socket.data.user?.sub;
    io.to(`user:${friendId}`).emit('friend:call:accepted', {
      fromUserId,
      friendId,
    });
  });

  socket.on('friend:call:reject', (data) => {
    const { friendId } = data;
    const fromUserId = socket.data.user?.sub;
    io.to(`user:${friendId}`).emit('friend:call:rejected', {
      fromUserId,
      friendId,
    });
  });

  socket.on('friend:call:end', (data) => {
    const { friendId } = data;
    const fromUserId = socket.data.user?.sub;
    io.to(`user:${friendId}`).emit('friend:call:ended', {
      fromUserId,
      friendId,
    });
  });

  // WebRTC signaling for friend calls
  socket.on('friend:webrtc:signal', (data) => {
    const { friendId, signal } = data;
    const fromUserId = socket.data.user?.sub;
    io.to(`user:${friendId}`).emit('friend:webrtc:signal', {
      fromUserId,
      friendId,
      signal,
    });
  });

  // Join user's personal room for friend calls and notifications
  socket.on('user:join', () => {
    const userId = socket.data.user?.sub;
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[Socket.IO] User ${userId} joined personal room`);
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Middleware to add CORS headers for static files (images)
app.use('/uploads', (req, res, next) => {
  // Set CORS headers for image requests
  const origin = req.headers.origin;
  
  // Allow all origins for image loading (images are public)
  // You can restrict this to specific origins if needed
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Allow cross-origin resource sharing for images
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Cache control for images
  if (req.path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/users', createUserRouter(io));
app.use('/api/parties', createPartyRouter(io));
app.use('/api/wallet', createWalletRouter(io));
app.use('/api/gifts', createGiftRouter(io));
app.use('/api/friends', createFriendsRouter(io));
app.use('/api/messages', createMessagesRouter(io));
app.use('/api/games', gamesRouter);
app.use('/api/admin', require('./routes/admin'));

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  if (status === 500) {
    console.error('Error:', err);
    console.error('Error stack:', err.stack);
    console.error('Request details:', {
      method: req.method,
      url: req.url,
      body: req.body,
      params: req.params,
      userId: req.user?._id,
    });
  }
  res.status(status).json({ error: message });
});

async function init() {
  try {
    await mongoose.connect(MONGO_URI, {
      autoIndex: true,
    });
    console.log('Connected to MongoDB');

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`API ready on port ${PORT}`);
    });

      // Initialize game engine after server is ready
      // Only initialize if not already initialized (e.g., on hot reload)
      if (!gameEngine) {
        setTimeout(() => {
          gameEngine = new GameEngine(io);
          gameEngine.start(); // This will set waiting state, not start immediately
          console.log('[Game Engine] Game engine initialized (waiting for clients)');
        }, 5000); // Wait 5 seconds for server to be fully ready
      } else {
        console.log('[Game Engine] Game engine already initialized.');
      }
  } catch (error) {
    console.error('Startup failed', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

init();

