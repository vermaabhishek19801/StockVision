const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Prediction = require('../models/Prediction');
const Watchlist = require('../models/Watchlist');
const Portfolio = require('../models/Portfolio');
const MarketConfig = require('../models/MarketConfig');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/helpers');

// GET /api/admin/db/status  — MongoDB connection info + per-collection counts
exports.getDbStatus = asyncHandler(async (req, res) => {
  const conn = mongoose.connection;
  const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const state = stateMap[conn.readyState] || 'unknown';

  // Parallel collection counts
  const [users, refreshTokens, predictions, watchlists, portfolios, marketConfigs] = await Promise.all([
    User.countDocuments(),
    RefreshToken.countDocuments(),
    Prediction.countDocuments(),
    Watchlist.countDocuments(),
    Portfolio.countDocuments(),
    MarketConfig.countDocuments()
  ]);

  // Try to get db stats (sizes) — not available on in-memory server, swallow error
  let dbStats = null;
  try {
    dbStats = await conn.db.command({ dbStats: 1, scale: 1024 }); // KB
  } catch (_) { /* in-memory server doesn't support dbStats */ }

  res.json({
    connection: {
      state,
      host: conn.host || 'in-memory',
      name: conn.name || 'stockvision',
      port: conn.port || null,
      inMemory: !conn.host
    },
    collections: { users, refreshTokens, predictions, watchlists, portfolios, marketConfigs },
    dbStats: dbStats ? {
      dataSize: Math.round(dbStats.dataSize),
      storageSize: Math.round(dbStats.storageSize),
      indexes: dbStats.indexes,
      indexSize: Math.round(dbStats.indexSize),
      unit: 'KB'
    } : null
  });
});

// GET /api/admin/db/activity  — recent user activity feed
exports.getRecentActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const [recentUsers, recentLogins, recentPredictions, lockedAccounts] = await Promise.all([
    User.find().select('name email role createdAt subscription.plan').sort('-createdAt').limit(limit),
    User.find({ lastLogin: { $exists: true } }).select('name email lastLogin lastLoginIP').sort('-lastLogin').limit(limit),
    Prediction.find().select('symbol requestedBy createdAt result.prediction').populate('requestedBy', 'name email').sort('-createdAt').limit(limit),
    User.find({ lockUntil: { $gt: new Date() } }).select('name email loginAttempts lockUntil').limit(20)
  ]);

  res.json({ recentUsers, recentLogins, recentPredictions, lockedAccounts });
});

// POST /api/admin/db/reset-password  — reset any user's password by email
exports.resetUserPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'email and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Prevent resetting superadmin unless you ARE superadmin
  if (user.role === 'superadmin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can reset another superadmin password' });
  }

  user.password = newPassword; // pre-save hook bcrypt-hashes it
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  // Revoke all sessions for that user
  await RefreshToken.deleteMany({ userId: user._id });

  logger.warn({ event: 'admin_password_reset', adminId: req.user._id, targetEmail: email });
  res.json({ message: `Password reset successful for ${email}. All sessions revoked.` });
});

// POST /api/admin/db/unlock  — unlock a locked account
exports.unlockAccount = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { $set: { loginAttempts: 0 }, $unset: { lockUntil: '' } },
    { new: true }
  ).select('name email loginAttempts lockUntil');

  if (!user) return res.status(404).json({ error: 'User not found' });

  logger.info({ event: 'admin_account_unlocked', adminId: req.user._id, targetEmail: email });
  res.json({ message: `Account unlocked for ${email}`, user });
});
