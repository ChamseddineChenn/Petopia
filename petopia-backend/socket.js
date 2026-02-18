const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

// Map: userId (string) → Set of socket IDs
const userSockets = new Map();

/**
 * Initialize Socket.IO on the HTTP server
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Authentication middleware — verify JWT on connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[WS] User connected: ${userId} (socket: ${socket.id})`);

    // Track user's sockets (supports multiple devices)
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join a personal room for targeted events
    socket.join(`user:${userId}`);

    // ----- Booking Lock System -----
    // Client requests a lock on a time slot while booking
    socket.on('lock_slot', ({ clinicId, date, timeSlot }) => {
      const room = `clinic:${clinicId}:${date}`;
      socket.join(room);

      // Notify others in the same clinic+date room that a slot is being held
      socket.to(room).emit('slot_locked', {
        clinicId,
        date,
        timeSlot,
        lockedBy: userId,
      });
    });

    // Client releases a slot lock (navigated away, cancelled, etc.)
    socket.on('unlock_slot', ({ clinicId, date, timeSlot }) => {
      const room = `clinic:${clinicId}:${date}`;
      socket.to(room).emit('slot_unlocked', {
        clinicId,
        date,
        timeSlot,
      });
    });

    // When a booking is confirmed/created, broadcast to everyone on that clinic+date
    socket.on('slot_booked', ({ clinicId, date, timeSlot }) => {
      const room = `clinic:${clinicId}:${date}`;
      io.to(room).emit('slot_taken', {
        clinicId,
        date,
        timeSlot,
      });
    });

    // Client joins a clinic date room to watch for real-time slot availability
    socket.on('watch_slots', ({ clinicId, date }) => {
      const room = `clinic:${clinicId}:${date}`;
      socket.join(room);
    });

    socket.on('unwatch_slots', ({ clinicId, date }) => {
      const room = `clinic:${clinicId}:${date}`;
      socket.leave(room);
    });

    // ----- Disconnect -----
    socket.on('disconnect', () => {
      console.log(`[WS] User disconnected: ${userId} (socket: ${socket.id})`);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
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
