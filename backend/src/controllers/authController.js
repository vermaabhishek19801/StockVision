const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService');
const logger = require('../utils/logger');

// ── H-4: asyncHandler wrapper ─────────────────────────────────────────────────
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── Token generation with JTI (C-1) ──────────────────────────────────────────
const generateTokens = (userId) => {
  const jti = crypto.randomUUID();
  const family = crypto.randomUUID();
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
  const refreshToken = jwt.sign(
    { id: userId, jti, family },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
  return { accessToken, refreshToken, jti, family };
};

// ── Store refresh token in DB (C-1) ──────────────────────────────────────────
const storeRefreshToken = async (jti, family, userId, req) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    jti, family, userId,
    userAgent: req.headers['user-agent']?.substring(0, 200),
    ip: req.ip,
    expiresAt
  });
};

// ── M-5: Set cookie with path restriction ─────────────────────────────────────
const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',               // only sent to auth endpoints
    maxAge: 7 * 24 * 60 * 60 * 1000,
    signed: true                     // M-5: signed cookie
  });
};

// ── H-2: Safe error response (never exposes internals in 5xx) ────────────────
const safeError = (res, status, msg, req) => {
  if (status >= 500) {
    return res.status(500).json({ error: 'Internal server error', requestId: req.id });
  }
  return res.status(status).json({ error: msg });
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const user = new User({ name, email, password });
  const emailToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = crypto.createHash('sha256').update(emailToken).digest('hex');
  user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  await user.save();

  const { accessToken, refreshToken, jti, family } = generateTokens(user._id);
  await storeRefreshToken(jti, family, user._id, req);
  setRefreshTokenCookie(res, refreshToken);

  // Send welcome email (non-blocking)
  sendWelcomeEmail(user).catch(() => {});

  logger.info({ event: 'user_register', userId: user._id, ip: req.ip });
  res.status(201).json({
    accessToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription }
  });
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +twoFactorEnabled +twoFactorSecret');
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.isActive) return res.status(403).json({ error: 'Account suspended. Contact support.' });
  if (user.isLocked()) return res.status(423).json({ error: 'Account locked after too many failed attempts. Try again in 2 hours.' });

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await user.incLoginAttempts();
    logger.warn({ event: 'login_failure', email, ip: req.ip });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLogin = Date.now();
  user.lastLoginIP = req.ip;
  await user.save({ validateBeforeSave: false });

  // 2FA challenge: issue short-lived temp token instead of full session
  if (user.twoFactorEnabled) {
    const tempToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET + '_2fa', { expiresIn: '5m' });
    logger.info({ event: 'login_2fa_challenge', userId: user._id, ip: req.ip });
    return res.json({ requires2FA: true, tempToken });
  }

  const { accessToken, refreshToken, jti, family } = generateTokens(user._id);
  await storeRefreshToken(jti, family, user._id, req);
  setRefreshTokenCookie(res, refreshToken);

  logger.info({ event: 'login_success', userId: user._id, ip: req.ip });
  res.json({
    accessToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription, preferences: user.preferences }
  });
});

// ── POST /api/auth/refresh (C-1: jti validation + rotation + reuse detection) ─
exports.refresh = asyncHandler(async (req, res) => {
  // M-5: read signed cookie
  const token = req.signedCookies?.refreshToken || req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const { id: userId, jti, family } = decoded;

  // C-1: Check the jti exists in our store
  const stored = await RefreshToken.findOne({ jti });

  if (!stored) {
    // Reuse detected — revoke entire token family
    logger.warn({ event: 'refresh_token_reuse', userId, family, ip: req.ip });
    await RefreshToken.deleteMany({ family });
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  // Revoke the current token (rotation)
  await RefreshToken.deleteOne({ jti });

  const user = await User.findById(userId);
  if (!user || !user.isActive) return res.status(401).json({ error: 'User not found' });

  // Issue a new token pair, same family
  const { accessToken, refreshToken: newRefresh, jti: newJti } = generateTokens(user._id);
  const newFamily = family; // keep family for reuse detection continuity
  await storeRefreshToken(newJti, newFamily, user._id, req);
  setRefreshTokenCookie(res, newRefresh);

  res.json({ accessToken });
});

// ── POST /api/auth/logout (C-1: actually revokes the token) ──────────────────
exports.logout = asyncHandler(async (req, res) => {
  const token = req.signedCookies?.refreshToken || req.cookies?.refreshToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      // Delete this specific token from the store
      await RefreshToken.deleteOne({ jti: decoded.jti });
    } catch {
      // Token already expired or invalid — still clear the cookie
    }
  }

  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Logged out successfully' });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always return same message (prevents user enumeration)
  const okResponse = { message: 'If that email exists, a reset link was sent.' };
  if (!user) return res.json(okResponse);

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // C-3: NEVER log the raw reset token
  logger.info({ event: 'password_reset_requested', userId: user._id });
  await sendPasswordResetEmail(user, resetToken).catch(() => {});

  // Only expose token in development response body (never in logs)
  const devExtra = process.env.NODE_ENV === 'development' ? { devToken: resetToken } : {};
  res.json({ ...okResponse, ...devExtra });
});

// ── PATCH /api/auth/reset-password/:token ────────────────────────────────────
exports.resetPassword = asyncHandler(async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
  if (!user) return res.status(400).json({ error: 'Token invalid or expired' });

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Revoke all existing refresh tokens for this user (force re-login everywhere)
  await RefreshToken.deleteMany({ userId: user._id });

  logger.info({ event: 'password_reset_success', userId: user._id, ip: req.ip });
  res.json({ message: 'Password reset successful. Please log in again.' });
});

// ── POST /api/auth/register-admin ─────────────────────────────────────────────
exports.registerAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, adminSecret } = req.body;

  // Constant-time comparison to prevent timing attacks
  const secretBuf = Buffer.from(process.env.ADMIN_REGISTRATION_SECRET || '');
  const providedBuf = Buffer.from(adminSecret || '');
  const match = secretBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(secretBuf, providedBuf);

  if (!match) {
    logger.warn({ event: 'admin_register_invalid_secret', ip: req.ip });
    return res.status(403).json({ error: 'Invalid admin registration secret' });
  }

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const user = new User({ name, email, password, role: 'admin' });
  user.subscription.plan = 'enterprise';
  user.subscription.status = 'active';
  user.isEmailVerified = true;
  user.updateSubscriptionFeatures();
  await user.save();

  logger.info({ event: 'admin_created', userId: user._id, createdBy: req.ip });
  res.status(201).json({ message: 'Admin account created', userId: user._id });
});
