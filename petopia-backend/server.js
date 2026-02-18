const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected: ' + conn.connection.host);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB runtime error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
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
  // Initialize Socket.IO on the HTTP server
  initSocket(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port ' + PORT);
  });
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
