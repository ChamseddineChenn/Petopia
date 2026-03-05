const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { updateLastSeen } = require('./services/hybridDelivery');

let io = null;

// Map: userId (string) → Set of socket IDs
const userSockets = new Map();

// Simple per-socket rate limiter with cleanup support
function createRateLimiter(maxPerMinute) {
  const counts = new Map();

  const check = (socketId) => {
    const now = Date.now();
    const entry = counts.get(socketId);
    if (!entry || now - entry.start > 60000) {
      counts.set(socketId, { start: now, count: 1 });
      return true;
    }
    entry.count++;
    if (entry.count > maxPerMinute) return false;
    return true;
  };

  // Remove entry on disconnect to prevent memory leak
  check.remove = (socketId) => counts.delete(socketId);

  return check;
}

const eventLimiter = createRateLimiter(60); // 60 events per minute per socket

// ── Slot Lock Tracking ──
// Server-side state prevents DoS via flood-locking other clinics' slots
const slotLocks = new Map(); // lockKey → { userId, timer }
const userActiveLocks = new Map(); // userId → Set<lockKey>
const MAX_LOCKS_PER_USER = 2;
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes auto-expire

function releaseLock(lockKey, ioRef) {
  const lock = slotLocks.get(lockKey);
  if (!lock) return;
  clearTimeout(lock.timer);
  slotLocks.delete(lockKey);
  const userLocks = userActiveLocks.get(lock.userId);
  if (userLocks) {
    userLocks.delete(lockKey);
    if (userLocks.size === 0) userActiveLocks.delete(lock.userId);
  }
  // Broadcast unlock to the room
  if (ioRef) {
    const parts = lockKey.split(':');
    const timeSlot = parts.pop();
    const date = parts.pop();
    const clinicId = parts.join(':');
    const room = `clinic:${clinicId}:${date}`;
    ioRef.to(room).emit('slot_unlocked', { clinicId, date, timeSlot });
  }
}

function releaseAllUserLocks(userId, ioRef) {
  const locks = userActiveLocks.get(userId);
  if (!locks) return;
  for (const key of [...locks]) {
    releaseLock(key, ioRef);
  }
}

// Validate a string looks like a MongoDB ObjectId
function isValidObjectId(str) {
  return typeof str === 'string' && mongoose.Types.ObjectId.isValid(str);
}

/**
 * Initialize Socket.IO on the HTTP server
 */
function initSocket(httpServer) {
  // CORS — restrict to known origins (reads same env var as Express)
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : false,
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Authentication middleware — verify JWT on connection
  io.use((socket, next) => {
    // Only accept token via auth object (not query string — prevents log leakage)
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
      });
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Track user's sockets (supports multiple devices)
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join a personal room for targeted events
    socket.join(`user:${userId}`);

    // ----- Booking Lock System -----
    socket.on('lock_slot', ({ clinicId, date, timeSlot }) => {
      if (!eventLimiter(socket.id)) return;
      if (
        !isValidObjectId(clinicId) ||
        typeof date !== 'string' ||
        typeof timeSlot !== 'string'
      )
        return;
      const safeDate = date.slice(0, 10); // YYYY-MM-DD only
      const safeSlot = timeSlot.slice(0, 20);
      const lockKey = `${clinicId}:${safeDate}:${safeSlot}`;

      // Reject if slot already locked by another user
      const existing = slotLocks.get(lockKey);
      if (existing && existing.userId !== userId) return;

      // Reject if this user already holds MAX_LOCKS
      const userLocks = userActiveLocks.get(userId);
      if (
        userLocks &&
        userLocks.size >= MAX_LOCKS_PER_USER &&
        !userLocks.has(lockKey)
      )
        return;

      // Register the lock with auto-expire TTL
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => releaseLock(lockKey, io), LOCK_TTL_MS);
      slotLocks.set(lockKey, { userId, socketId: socket.id, timer });
      if (!userActiveLocks.has(userId)) userActiveLocks.set(userId, new Set());
      userActiveLocks.get(userId).add(lockKey);

      const room = `clinic:${clinicId}:${safeDate}`;
      socket.join(room);
      socket.to(room).emit('slot_locked', {
        clinicId,
        date: safeDate,
        timeSlot: safeSlot,
        lockedBy: userId,
      });
    });

    socket.on('unlock_slot', ({ clinicId, date, timeSlot }) => {
      if (!eventLimiter(socket.id)) return;
      if (!isValidObjectId(clinicId) || typeof date !== 'string') return;
      const safeDate = date.slice(0, 10);
      const safeSlot = (timeSlot || '').slice(0, 20);
      const lockKey = `${clinicId}:${safeDate}:${safeSlot}`;

      // Only the lock owner can unlock
      const lock = slotLocks.get(lockKey);
      if (!lock || lock.userId !== userId) return;

      releaseLock(lockKey, io);
    });

    // NOTE: slot_booked removed — slot_taken is now only emitted server-side
    // via broadcastSlotUpdate() after a confirmed booking in the REST API.

    // Client joins a clinic date room to watch for real-time slot availability
    socket.on('watch_slots', ({ clinicId, date }) => {
      if (!eventLimiter(socket.id)) return;
      if (!isValidObjectId(clinicId) || typeof date !== 'string') return;
      const safeDate = date.slice(0, 10);
      const room = `clinic:${clinicId}:${safeDate}`;
      socket.join(room);
    });

    socket.on('unwatch_slots', ({ clinicId, date }) => {
      if (!eventLimiter(socket.id)) return;
      if (!isValidObjectId(clinicId) || typeof date !== 'string') return;
      const safeDate = date.slice(0, 10);
      const room = `clinic:${clinicId}:${safeDate}`;
      socket.leave(room);
    });

    // ----- Chat Events -----
    // User joins a conversation room — verify they are a participant
    socket.on('join_conversation', async (conversationId) => {
      if (!eventLimiter(socket.id)) return;
      if (!isValidObjectId(conversationId)) return;

      try {
        const Conversation = require('./models/Conversation');
        const conv = await Conversation.findById(conversationId)
          .select('participants')
          .lean();
        if (!conv || !conv.participants.some((p) => p.toString() === userId)) {
          return; // Silently refuse — don't leak info
        }
        socket.join(`conv:${conversationId}`);
      } catch (err) {
        // ignore
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (!eventLimiter(socket.id)) return;
      if (!isValidObjectId(conversationId)) return;
      socket.leave(`conv:${conversationId}`);
    });

    // Typing indicator
    socket.on('typing', ({ conversationId, isTyping }) => {
      if (!eventLimiter(socket.id)) return;
      if (!isValidObjectId(conversationId)) return;
      socket.to(`conv:${conversationId}`).emit('user_typing', {
        conversationId,
        userId,
        isTyping: !!isTyping,
      });
    });

    // When a user connects, mark their undelivered messages as delivered
    const markDeliveredOnConnect = async () => {
      try {
        const Message = require('./models/Message');
        const Conversation = require('./models/Conversation');

        // Find all conversations this user is in
        const conversations = await Conversation.find({
          participants: userId,
        }).lean();

        for (const conv of conversations) {
          // Update all sent (not yet delivered) messages from others
          const updated = await Message.updateMany(
            {
              conversation: conv._id,
              sender: { $ne: userId },
              status: 'sent',
            },
            {
              $set: { status: 'delivered', deliveredAt: new Date() },
            },
          );

          if (updated.modifiedCount > 0) {
            // Notify the sender
            const senderId = conv.participants.find(
              (p) => p.toString() !== userId,
            );
            if (senderId) {
              io.to(`user:${senderId.toString()}`).emit('message_status', {
                conversationId: conv._id.toString(),
                status: 'delivered',
                deliveredAt: new Date(),
                bulk: true,
              });
            }
          }
        }
      } catch (err) {
        console.error('[WS] Auto-deliver error:', err.message);
      }
    };

    markDeliveredOnConnect();

    // ----- Disconnect -----
    socket.on('disconnect', () => {
      // Clean up rate limiter entry to prevent memory leak
      eventLimiter.remove(socket.id);

      // Release any slot locks held by this socket's user
      releaseAllUserLocks(userId, io);

      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          // Update lastSeen when fully offline (no remaining sockets)
          updateLastSeen(userId);
        }
      }
    });
  });

  console.log('[WS] Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance
 */
function getIO() {
  if (!io) {
    throw new Error(
      'Socket.IO not initialized. Call initSocket(server) first.',
    );
  }
  return io;
}

/**
 * Send a real-time notification to a specific user
 */
function sendToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Check if a specific user is currently online
 */
function isUserOnline(userId) {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
}

/**
 * Broadcast a slot update to everyone watching a specific clinic+date
 */
function broadcastSlotUpdate(clinicId, date, data) {
  if (io) {
    const room = `clinic:${clinicId}:${date}`;
    io.to(room).emit('slot_update', data);
  }
}

module.exports = {
  initSocket,
  getIO,
  sendToUser,
  isUserOnline,
  broadcastSlotUpdate,
};
