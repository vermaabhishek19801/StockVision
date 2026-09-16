const stockService = require('./stockService');
const logger = require('../utils/logger');

let io;
const subscriptions = new Map(); // socketId -> Set of symbols

const initSocketHandlers = (socketIo) => {
  io = socketIo;

  io.use(async (socket, next) => {
    // Optional auth for WebSocket
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const User = require('../models/User');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = await User.findById(decoded.id);
      } catch { /* anonymous */ }
    }
    next();
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);
    subscriptions.set(socket.id, new Set());

    // Subscribe to a stock — H-3: validate symbol before any external API call
    socket.on('subscribe', async (symbol) => {
      // H-3: Type check and character allowlist
      if (typeof symbol !== 'string' || !/^[A-Z0-9.\-^]{1,20}$/i.test(symbol)) {
        socket.emit('error', { message: 'Invalid symbol format' });
        return;
      }

      const userSymbols = subscriptions.get(socket.id);
      if (!userSymbols) return;

      // Limit symbols for non-paying users
      const maxSymbols = socket.user?.subscription?.features?.realTimeData ? 50 : 5;
      if (userSymbols.size >= maxSymbols) {
        socket.emit('error', { message: `Subscription limit: max ${maxSymbols} symbols. Upgrade for more.` });
        return;
      }

      userSymbols.add(symbol.toUpperCase());
      socket.join(`stock:${symbol.toUpperCase()}`);
      logger.debug(`Socket ${socket.id} subscribed to ${symbol}`);

      // Send initial quote
      const quote = await stockService.fetchYahooQuote(symbol);
      if (quote) socket.emit('quote', { symbol: symbol.toUpperCase(), ...quote });
    });

    // Unsubscribe
    socket.on('unsubscribe', (symbol) => {
      const userSymbols = subscriptions.get(socket.id);
      if (userSymbols) userSymbols.delete(symbol.toUpperCase());
      socket.leave(`stock:${symbol.toUpperCase()}`);
    });

    socket.on('disconnect', () => {
      subscriptions.delete(socket.id);
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  // L-2: Both broadcast loops must be started
  startLiveBroadcast();
  startIndexBroadcast();
};

const startLiveBroadcast = () => {
  setInterval(async () => {
    // Get all unique subscribed symbols
    const allSymbols = new Set();
    subscriptions.forEach(symbols => symbols.forEach(s => allSymbols.add(s)));

    if (allSymbols.size === 0) return;

    const symbolList = Array.from(allSymbols);
    const quotes = await Promise.allSettled(
      symbolList.map(symbol => stockService.fetchYahooQuote(symbol))
    );

    quotes.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        const symbol = symbolList[i];
        io.to(`stock:${symbol}`).emit('quote', {
          symbol,
          ...result.value,
          liveUpdate: true,
          timestamp: new Date()
        });
      }
    });
  }, 15000);
};

// Broadcast market indices every 60 seconds
const startIndexBroadcast = () => {
  setInterval(async () => {
    try {
      const indices = await stockService.getIndices();
      io.emit('indices', { indices, timestamp: new Date() });
    } catch (err) {
      logger.error('Index broadcast error:', err.message);
    }
  }, 60000);
};

module.exports = { initSocketHandlers };
