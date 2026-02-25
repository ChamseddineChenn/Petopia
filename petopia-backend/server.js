const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
require('dotenv').config();

// ========================================
// Startup Guards — fail fast if critical env vars are missing
// ========================================
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('FATAL: MONGODB_URI environment variable is not set');
  process.exit(1);
}

const { initSocket } = require('./socket');
const { initFCM } = require('./services/hybridDelivery');

const app = express();
const server = http.createServer(app);

// ========================================
// Security Middleware
// ========================================

// Set security HTTP headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
app.use(helmet());

// CORS — restrict to known origins (add your production domain)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// Global rate limiter — 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});
app.use(globalLimiter);

// ── Stripe webhook needs raw body BEFORE json parser ──
// Stripe requires the raw Buffer body to verify webhook signatures.
// This must be registered before express.json() middleware.
app.use(
  '/api/payments/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
);

// Body parsers — reduced limits (upload routes have their own higher limits)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitize request data — strips $ and . from req.body/query/params to prevent NoSQL injection
app.use(mongoSanitize());

// Prevent HTTP parameter pollution
app.use(hpp());

// ========================================
// MongoDB Connection (auto-reconnect)
// ========================================
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB connected: ' + conn.connection.host);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.log('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB runtime error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected — will auto-reconnect');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pets', require('./routes/pets'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/user', require('./routes/user'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/health-records', require('./routes/healthRecords'));
app.use('/api/vets', require('./routes/vets'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/groomers', require('./routes/groomers'));
app.use('/api/groomer-reviews', require('./routes/groomerReviews'));
app.use('/api/groomer-appointments', require('./routes/groomerAppointments'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/shops', require('./routes/shops'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/payments', require('./routes/payments'));

// Health check
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  res.json({
    status: 'OK',
    database: states[dbState] || 'unknown',
    timestamp: new Date(),
  });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  // Initialize Firebase Cloud Messaging (push notifications)
  initFCM();

  // Initialize Socket.IO on the HTTP server
  initSocket(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port ' + PORT);
  });
});

// ========================================
// Keep-alive: prevent idle disconnects
// ========================================
setInterval(() => {
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.db
      .admin()
      .ping()
      .catch(() => {});
  }
}, 60000); // ping every 60s

// ========================================
// Crash guards — log and exit, let process manager restart
// ========================================
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — shutting down:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION (server kept alive):', reason);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await mongoose.connection.close();
  process.exit(0);
});
