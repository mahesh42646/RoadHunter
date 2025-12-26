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
const createCallsRouter = require('./routes/calls');
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
app.use(express.json({ limit: '100mb' })); // Increased for large JSON payloads
app.use(express.urlencoded({ extended: true, limit: '100mb' })); // Increased for form data

// Increase body size limit for raw data (for file uploads)
app.use(express.raw({ limit: '100mb', type: 'application/octet-stream' }));

// Increase server timeout for large file uploads
const server = http.createServer(app);
server.timeout = 300000; // 5 minutes for large file uploads
server.keepAliveTimeout = 65000; // Keep connections alive longer
server.headersTimeout = 66000; // Headers timeout

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

// Track online users
const onlineUsers = new Map(); // userId -> { socketId, lastSeen }

io.on('connection', (socket) => {
  console.log(`[Socket.IO] ✅ Client connected: ${socket.id}`);
  
  // Auto-join user's personal room for notifications
  const userId = socket.data.user?.sub;
  if (userId) {
    socket.join(`user:${userId}`);
    // Mark user as online
    onlineUsers.set(userId, { socketId: socket.id, lastSeen: Date.now() });
    // Notify others that user is online
    io.emit('user:online', { userId });
    console.log(`[Socket.IO] User ${userId} auto-joined personal room and marked as online`);
  }

  // Handle explicit user:join event (for reconnection scenarios)
  socket.on('user:join', () => {
    const userId = socket.data.user?.sub;
    if (userId) {
      socket.join(`user:${userId}`);
      onlineUsers.set(userId, { socketId: socket.id, lastSeen: Date.now() });
      console.log(`[Socket.IO] User ${userId} explicitly joined personal room via user:join event`);
    }
  });
  
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
  socket.on('disconnect', async () => {
    console.log(`[Socket.IO] ❌ Client disconnected: ${socket.id}`);
    
    // Mark user as offline
    if (userId) {
      onlineUsers.delete(userId);
      // Notify others that user is offline
      io.emit('user:offline', { userId });
      console.log(`[Socket.IO] User ${userId} marked as offline`);
      
      // Immediately remove user from all parties they're in
      try {
        const Party = require('./schemas/party');
        const parties = await Party.find({
          'participants.userId': userId,
          'participants.status': { $in: ['active', 'muted', 'offline'] },
          isActive: true,
        });
        
        for (const party of parties) {
          const participant = party.participants.find(
            (p) => p.userId && p.userId.toString() === userId.toString()
          );
          
          if (participant) {
            const isHost = party.hostId && party.hostId.toString() === userId.toString();
            
            // Remove participant
            const participantIndex = party.participants.findIndex(
              (p) => p.userId && p.userId.toString() === userId.toString()
            );
            
            if (participantIndex !== -1) {
              party.participants.splice(participantIndex, 1);
            }
            
            // If host left and no active participants, end party
            if (isHost) {
              const activeParticipants = party.participants.filter(
                (p) => p.userId && (p.status === 'active' || p.status === 'muted')
              );
              
              if (activeParticipants.length === 0) {
                party.isActive = false;
                io.emit('party:ended', { partyId: party._id.toString() });
              }
            }
            
            await party.save();
            
            // Emit socket event
            io.to(`party:${party._id}`).emit('party:participantLeft', {
              partyId: party._id.toString(),
              userId: userId,
              isHost: isHost,
            });
          }
        }
      } catch (error) {
        console.error('[Socket.IO] Error removing user from parties on disconnect:', error);
      }
    }
    
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
    const { friendId, callType = 'video' } = data;
    const fromUserId = socket.data.user?.sub;
    
    if (!fromUserId) {
      socket.emit('friend:call:error', { error: 'Not authenticated' });
      return;
    }

    // Verify they are friends
    try {
      const User = require('./schemas/users');
      const Party = require('./schemas/party');
      const Call = require('./schemas/calls');
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

      // Check if friend is online
      if (!onlineUsers || !onlineUsers.has(friendId)) {
        socket.emit('friend:call:error', { error: 'User is offline' });
        return;
      }

      // Check if friend is busy (hosting a party)
      const activeParty = await Party.findOne({
        hostId: friendId,
        isActive: true,
      });
      if (activeParty) {
        socket.emit('friend:call:error', { error: 'User is busy (in a party)' });
        return;
      }

      // Create call record
      const call = await Call.create({
        callerId: fromUserId,
        receiverId: friendId,
        callType,
        status: 'initiated',
        callerInfo: {
          displayName: user.account?.displayName,
          photoUrl: user.account?.photoUrl,
        },
        receiverInfo: {
          displayName: friend.account?.displayName,
          photoUrl: friend.account?.photoUrl,
        },
      });

      // Find friend's socket (they should be in a room with their userId)
      console.log(`[Socket.IO] Emitting friend:call:incoming to user:${friendId} from ${fromUserId}`);
      console.log(`[Socket.IO] Call ID: ${call._id}`);
      
      // Update call status to ringing
      call.status = 'ringing';
      await call.save();
      
      // Emit to friend's room
      io.to(`user:${friendId}`).emit('friend:call:incoming', {
        fromUserId,
        friendId,
        callId: call._id.toString(),
        callType,
      });
      
      // Also emit to all sockets of the friend (in case they have multiple connections)
      const friendSockets = await io.in(`user:${friendId}`).fetchSockets();
      console.log(`[Socket.IO] Friend ${friendId} has ${friendSockets.length} socket(s) in room`);
      
      if (friendSockets.length === 0) {
        console.log(`[Socket.IO] WARNING: Friend ${friendId} has no active socket connections`);
        // Mark call as missed
        call.status = 'missed';
        call.endedAt = new Date();
        await call.save();
        socket.emit('friend:call:error', { error: 'Friend is not online or not connected' });
      } else {
        // Also broadcast to all connected clients for this user (for call history updates)
        io.emit('call:new', {
          callId: call._id.toString(),
          callerId: fromUserId,
          receiverId: friendId,
          status: 'ringing',
        });
        
        // Also emit to caller's room so they get the callId
        io.to(`user:${fromUserId}`).emit('call:new', {
          callId: call._id.toString(),
          callerId: fromUserId,
          receiverId: friendId,
          status: 'ringing',
        });
      }
    } catch (error) {
      console.error('[Socket.IO] Error initiating friend call:', error);
      socket.emit('friend:call:error', { error: 'Failed to initiate call' });
    }
  });

  socket.on('friend:call:accept', async (data) => {
    const { friendId, callId } = data;
    const fromUserId = socket.data.user?.sub;
    
    try {
      const Call = require('./schemas/calls');
      if (callId) {
        const call = await Call.findById(callId);
        if (call) {
          call.status = 'connected';
          call.answeredAt = new Date();
          await call.save();
          
          // Broadcast call update
          io.emit('call:updated', {
            callId: call._id.toString(),
            status: 'connected',
          });
        }
      }
    } catch (error) {
      console.error('[Socket.IO] Error updating call status:', error);
    }
    
    io.to(`user:${friendId}`).emit('friend:call:accepted', {
      fromUserId,
      friendId,
      callId,
    });
  });

  socket.on('friend:call:reject', async (data) => {
    const { friendId, callId } = data;
    const fromUserId = socket.data.user?.sub;
    
    try {
      const Call = require('./schemas/calls');
      if (callId) {
        const call = await Call.findById(callId);
        if (call) {
          call.status = 'rejected';
          call.endedAt = new Date();
          await call.save();
          
          // Broadcast call update
          io.emit('call:updated', {
            callId: call._id.toString(),
            status: 'rejected',
          });
        }
      }
    } catch (error) {
      console.error('[Socket.IO] Error updating call status:', error);
    }
    
    io.to(`user:${friendId}`).emit('friend:call:rejected', {
      fromUserId,
      friendId,
      callId,
    });
  });

  socket.on('friend:call:end', async (data) => {
    const { friendId, callId } = data;
    const fromUserId = socket.data.user?.sub;
    
    try {
      const Call = require('./schemas/calls');
      if (callId) {
        const call = await Call.findById(callId);
        if (call) {
          call.status = 'ended';
          call.endedAt = new Date();
          if (call.answeredAt) {
            call.duration = Math.floor((new Date() - call.answeredAt) / 1000);
          }
          await call.save();
          
          // Broadcast call update
          io.emit('call:updated', {
            callId: call._id.toString(),
            status: 'ended',
          });
        }
      }
    } catch (error) {
      console.error('[Socket.IO] Error updating call status:', error);
    }
    
    io.to(`user:${friendId}`).emit('friend:call:ended', {
      fromUserId,
      friendId,
      callId,
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
app.use('/api/friends', createFriendsRouter(io, onlineUsers));
app.use('/api/messages', createMessagesRouter(io));
app.use('/api/calls', createCallsRouter(io));
app.use('/api/games', gamesRouter);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payment-admin', require('./routes/paymentAdmin'));
app.use('/api/deposits', require('./routes/deposits'));

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  
  // For upload routes, show actual error message
  if (req.url.includes('/cars/upload')) {
    console.error('[Global Error Handler] Upload error:', {
      message: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack,
      requestUrl: req.url,
      requestMethod: req.method,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });
    
    // Don't send generic "Internal server error" for upload errors
    const message = err.message || 'File upload failed';
    return res.status(status).json({ error: message });
  }
  
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

    // Fix firebaseUid index to be sparse (allows multiple null values for quick login users)
    try {
      const User = require('./schemas/users');
      const db = mongoose.connection.db;
      const collection = db.collection('users');
      
      // Drop the old non-sparse index if it exists
      try {
        await collection.dropIndex('account.firebaseUid_1');
        console.log('[Index Migration] Dropped old firebaseUid index');
      } catch (dropError) {
        // Index might not exist, that's okay
        if (dropError.code !== 27) { // 27 = IndexNotFound
          console.log('[Index Migration] Old index not found or already dropped');
        }
      }
      
      // Create the new sparse index
      await collection.createIndex({ 'account.firebaseUid': 1 }, { unique: true, sparse: true });
      console.log('[Index Migration] Created sparse firebaseUid index');
    } catch (indexError) {
      console.error('[Index Migration] Error fixing firebaseUid index:', indexError.message);
      // Don't fail startup if index migration fails
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`API ready on port ${PORT}`);
    });

    // Initialize default parties and bots (after MongoDB is connected)
    // Note: initDefaultParties expects MongoDB to already be connected
    setTimeout(async () => {
      try {
        const initDefaultParties = require('./scripts/initDefaultParties');
        await initDefaultParties();
        console.log('[Server] ✅ Default parties initialized');
      } catch (initError) {
        console.error('[Server] ❌ Error initializing default parties:', initError.message);
        // Don't fail server startup if default parties fail to initialize
      }
    }, 2000); // Wait 2 seconds after MongoDB connection

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

// Cleanup job: Remove offline/stale participants and end empty parties
// This runs independently of the server startup
setInterval(async () => {
  try {
    const Party = require('./schemas/party');
    // Get all active parties
    const parties = await Party.find({
      isActive: true,
    });
    
    const now = new Date();
    const OFFLINE_THRESHOLD = 30000; // 30 seconds
    const STALE_ACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes - if active but no socket connection
    
    for (const party of parties) {
      let updated = false;
      let removedParticipants = [];
      
      // Check each participant
      for (let i = party.participants.length - 1; i >= 0; i--) {
        const participant = party.participants[i];
        
        if (!participant.userId) continue;
        
        let shouldRemove = false;
        const isHost = party.hostId && party.hostId.toString() === participant.userId.toString();
        
        // Check if participant is offline and has been offline for more than 30 seconds
        if (participant.status === 'offline') {
          if (participant.offlineAt) {
            const offlineDuration = now - new Date(participant.offlineAt);
            if (offlineDuration >= OFFLINE_THRESHOLD) {
              shouldRemove = true;
            }
          } else {
            // Old data - offline but no timestamp, remove immediately
            shouldRemove = true;
          }
        }
        // Check if participant is marked as active but hasn't been seen in a while
        // This catches cases where socket disconnect didn't properly mark them as offline
        else if (participant.status === 'active' || participant.status === 'muted') {
          // Check if user has an active socket connection
          const userId = participant.userId.toString();
          const hasActiveSocket = onlineUsers.has(userId) && onlineUsers.get(userId);
          
          if (!hasActiveSocket) {
            // No active socket - check how long they've been inactive
            // Use joinedAt as a proxy for last activity (not perfect but better than nothing)
            if (participant.joinedAt) {
              const inactiveDuration = now - new Date(participant.joinedAt);
              // If they joined more than 5 minutes ago and have no socket, they're likely stale
              if (inactiveDuration >= STALE_ACTIVE_THRESHOLD) {
                shouldRemove = true;
              }
            } else {
              // No joinedAt timestamp - very old data, remove
              shouldRemove = true;
            }
          }
        }
        
        if (shouldRemove) {
          removedParticipants.push({
            userId: participant.userId.toString(),
            isHost: isHost,
          });
          
          // Remove participant
          party.participants.splice(i, 1);
          updated = true;
        }
      }
      
      // Check if party should be ended (no active participants)
      // BUT: Never end default parties - they stay active forever
      if ((updated || party.participants.length === 0) && !party.isDefault) {
        const activeParticipants = party.participants.filter(
          (p) => p.userId && (p.status === 'active' || p.status === 'muted')
        );
        
        // If no active participants, end the party (only for non-default parties)
        if (activeParticipants.length === 0) {
          party.isActive = false;
          party.endedAt = new Date();
          updated = true;
          
          if (io) {
            io.emit('party:ended', { partyId: party._id.toString() });
          }
        }
      } else if (party.isDefault) {
        // For default parties, ensure bot host is always present as active participant
        // If bot host participant was removed, re-add it
        const botHostParticipant = party.participants.find(
          (p) => p.userId && party.hostId && p.userId.toString() === party.hostId.toString()
        );
        
        if (!botHostParticipant && party.hostId) {
          // Re-add bot host as active participant
          const Bot = require('./schemas/bot');
          const bot = await Bot.findById(party.botHostId).lean();
          if (bot) {
            party.addParticipant(party.hostId, bot.name, bot.avatarUrl || null, 'host');
            updated = true;
            console.log(`[Cleanup Job] Re-added bot host to default party ${party.name}`);
          }
        }
      }
      
      // Save changes and emit events
      if (updated) {
        await party.save();
        
        // Emit socket events for removed participants
        if (io && removedParticipants.length > 0) {
          for (const removed of removedParticipants) {
            io.to(`party:${party._id}`).emit('party:participantLeft', {
              partyId: party._id.toString(),
              userId: removed.userId,
              isHost: removed.isHost,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[Cleanup Job] Error removing offline/stale participants:', error);
  }
}, 10000); // Run every 10 seconds

