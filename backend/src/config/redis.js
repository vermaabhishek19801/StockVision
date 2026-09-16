const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient = null;
let redisAvailable = false;

const connectRedis = async () => {
  try {
    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries) => {
          // Stop retrying after 3 attempts — Redis is optional
          if (retries >= 3) {
            logger.warn('Redis not available after 3 attempts. Running without cache (performance reduced).');
            return false; // stop reconnecting
          }
          return Math.min(retries * 500, 2000);
        }
      }
    });

    client.on('error', (err) => {
      if (redisAvailable) {
        logger.warn('Redis connection lost:', err.code);
        redisAvailable = false;
      }
    });
    client.on('ready', () => {
      redisAvailable = true;
      logger.info('Redis connected');
    });

    await client.connect();
    redisClient = client;
    redisAvailable = true;
    return client;
  } catch (error) {
    logger.warn('Redis not available, running without cache:', error.message);
    return null;
  }
};

const getRedisClient = () => redisClient;

const setCache = async (key, value, ttlSeconds = 60) => {
  if (!redisAvailable || !redisClient?.isOpen) return false;
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch { return false; }
};

const getCache = async (key) => {
  if (!redisAvailable || !redisClient?.isOpen) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

const delCache = async (key) => {
  if (!redisAvailable || !redisClient?.isOpen) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch { return false; }
};

module.exports = { connectRedis, getRedisClient, setCache, getCache, delCache };
