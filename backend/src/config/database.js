const mongoose = require('mongoose');
const logger = require('../utils/logger');

let memoryServerInstance = null;

// Try to connect to real MongoDB; if it fails and we're in dev, spin up an in-memory server
const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/stockvision';

  // First try real MongoDB
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000, // fail fast if MongoDB not running
      maxPoolSize: 10,
    });
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
    return;
  } catch (realErr) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('MongoDB connection failed (production):', realErr.message);
      throw realErr;
    }
    logger.warn(`Real MongoDB not available (${realErr.message}). Starting in-memory MongoDB for development...`);
  }

  // Fallback: in-memory MongoDB for local dev
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServerInstance = await MongoMemoryServer.create();
    const memUri = memoryServerInstance.getUri();
    await mongoose.connect(memUri, { maxPoolSize: 10 });
    logger.info(`[DEV] In-memory MongoDB running at ${memUri}`);
    logger.warn('[DEV] Data will NOT persist between restarts. Install MongoDB for persistent storage.');
  } catch (memErr) {
    logger.error('In-memory MongoDB also failed:', memErr.message);
    throw memErr;
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.disconnect();
  if (memoryServerInstance) await memoryServerInstance.stop();
});

module.exports = connectDB;
