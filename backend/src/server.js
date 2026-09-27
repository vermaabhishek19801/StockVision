require('dotenv').config();
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const connectDB = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initSocketHandlers } = require('./services/socketService');

// ── M-1: Startup environment validation ─────────────────────────────────────
const REQUIRED_SECRETS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'ADMIN_REGISTRATION_SECRET'];
const PLACEHOLDER_PATTERNS = ['your_', 'change_in_production', 'secret_key'];

if (process.env.NODE_ENV === 'production') {
  const invalid = REQUIRED_SECRETS.filter(key => {
    const val = process.env[key];
    if (!val || val.length < 32) return true;
    return PLACEHOLDER_PATTERNS.some(p => val.toLowerCase().includes(p));
  });
  if (invalid.length) {
    logger.error(`STARTUP ABORTED: Weak or missing secrets: ${invalid.join(', ')}. Set strong values in .env before running in production.`);
    process.exit(1);
  }
}

if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET === 'your_cookie_secret') {
  process.env.COOKIE_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
}

// ── Routes ───────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const stockRoutes = require('./routes/stock');
const watchlistRoutes = require('./routes/watchlist');
const portfolioRoutes = require('./routes/portfolio');
const subscriptionRoutes = require('./routes/subscription');
const predictionRoutes = require('./routes/prediction');
const configRoutes = require('./routes/config');
const marketRoutes = require('./routes/market');
const twoFactorRoutes = require('./routes/twoFactor');
const dbRoutes = require('./routes/db');

const app = express();
const server = http.createServer(app);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'https:'],
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// ── Rate Limiters ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' }
});

// M-2: Stricter rate limit on admin routes
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many admin requests.' }
});

app.use(globalLimiter);
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
// M-5: cookie secret so cookies can be signed
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(mongoSanitize());
app.use(hpp());

// L-1: Request correlation ID for security tracing
app.use((req, _res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Production: structured log with request ID
  app.use(morgan((tokens, req, res) =>
    JSON.stringify({
      id: req.id,
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: tokens.status(req, res),
      ms: tokens['response-time'](req, res),
      ip: req.ip
    })
  ));
}

// ── Health check (minimal — no timestamp leak) ────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ── M-8: CSRF token endpoint ─────────────────────────────────────────────────
// Issues a per-session CSRF nonce stored in a signed HttpOnly cookie.
// Clients read X-CSRF-Token from the response header and include it in
// mutating requests. The check is enforced in the protect middleware.
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrfToken', token, {
    httpOnly: false,   // JS-readable so frontend can read and resend it
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 4 * 60 * 60 * 1000  // 4 hours
  });
  res.json({ csrfToken: token });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth/2fa', authLimiter, twoFactorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/admin/db', adminLimiter, dbRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/predict', predictionRoutes);
app.use('/api/config', configRoutes);
app.use('/api/market', marketRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── H-4: Global error handler (never leaks internals) ────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  logger.error({
    id: req.id,
    status,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  // H-2: Never expose internal error details to client
  const clientMsg = (process.env.NODE_ENV !== 'production' && status < 500)
    ? err.message
    : 'Internal server error';
  res.status(status).json({ error: clientMsg, requestId: req.id });
});

// ── H-4: Catch unhandled promise rejections (prevent process crash) ───────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
  // Do NOT exit — log and continue in dev; in production consider graceful restart
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  if (process.env.NODE_ENV === 'production') process.exit(1);
});

initSocketHandlers(io);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    server.listen(PORT, () => {
      logger.info(`StockVision server running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, io };
