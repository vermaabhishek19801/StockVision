const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { send2FAEnabledEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── POST /api/auth/2fa/setup ──────────────────────────────────────────────────
// Generates a TOTP secret and returns QR code + backup codes
exports.setup2FA = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user.twoFactorEnabled) {
    return res.status(400).json({ error: '2FA is already enabled on this account' });
  }

  const secret = speakeasy.generateSecret({
    name: `StockVision (${user.email})`,
    issuer: 'StockVision',
    length: 32
  });

  // Save temp secret (not yet confirmed)
  user.twoFactorSecret = secret.base32;
  await user.save({ validateBeforeSave: false });

  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  // Generate 8 backup codes
  const backupCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
  user.twoFactorBackupCodes = backupCodes.map(c =>
    crypto.createHash('sha256').update(c).digest('hex')
  );
  await user.save({ validateBeforeSave: false });

  res.json({
    secret: secret.base32,
    qrCode: qrDataUrl,
    manualCode: secret.base32,
    backupCodes  // show once — user must save these
  });
});

// ── POST /api/auth/2fa/verify ─────────────────────────────────────────────────
// Verifies TOTP token and marks 2FA as enabled
exports.verify2FA = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'TOTP token required' });

  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (!user.twoFactorSecret) {
    return res.status(400).json({ error: 'Run 2FA setup first' });
  }

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: token.replace(/\s/g, ''),
    window: 1  // allow ±30s drift
  });

  if (!verified) return res.status(400).json({ error: 'Invalid TOTP token' });

  user.twoFactorEnabled = true;
  await user.save({ validateBeforeSave: false });

  await send2FAEnabledEmail(user).catch(() => {}); // non-blocking

  logger.info({ event: '2fa_enabled', userId: user._id, ip: req.ip });
  res.json({ message: '2FA enabled successfully' });
});

// ── POST /api/auth/2fa/disable ────────────────────────────────────────────────
exports.disable2FA = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'TOTP token and password required' });

  const user = await User.findById(req.user._id).select('+password +twoFactorSecret');
  const pwMatch = await user.comparePassword(password);
  if (!pwMatch) return res.status(401).json({ error: 'Incorrect password' });

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: token.replace(/\s/g, ''),
    window: 1
  });
  if (!verified) return res.status(400).json({ error: 'Invalid TOTP token' });

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  user.twoFactorBackupCodes = undefined;
  await user.save({ validateBeforeSave: false });

  logger.info({ event: '2fa_disabled', userId: user._id, ip: req.ip });
  res.json({ message: '2FA has been disabled' });
});

// ── POST /api/auth/2fa/validate ───────────────────────────────────────────────
// Called during login when 2FA is required
exports.validate2FA = asyncHandler(async (req, res) => {
  const { tempToken, totpToken } = req.body;
  if (!tempToken || !totpToken) return res.status(400).json({ error: 'tempToken and totpToken required' });

  const jwt = require('jsonwebtoken');
  let decoded;
  try {
    decoded = jwt.verify(tempToken, process.env.JWT_SECRET + '_2fa');
  } catch {
    return res.status(401).json({ error: 'Temp token invalid or expired' });
  }

  const user = await User.findById(decoded.id).select('+twoFactorSecret +twoFactorBackupCodes');
  if (!user || !user.twoFactorEnabled) return res.status(401).json({ error: 'User not found or 2FA not enabled' });

  // Check regular TOTP
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token: totpToken.replace(/\s/g, ''),
    window: 1
  });

  // Check backup codes as fallback
  let usedBackup = false;
  if (!verified) {
    const hashedInput = crypto.createHash('sha256').update(totpToken.toUpperCase()).digest('hex');
    const idx = (user.twoFactorBackupCodes || []).indexOf(hashedInput);
    if (idx !== -1) {
      user.twoFactorBackupCodes.splice(idx, 1); // consume backup code
      await user.save({ validateBeforeSave: false });
      usedBackup = true;
    } else {
      return res.status(400).json({ error: 'Invalid TOTP token' });
    }
  }

  const crypto2 = require('crypto');
  const RefreshToken = require('../models/RefreshToken');
  const jti = crypto2.randomUUID();
  const family = crypto2.randomUUID();
  const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });
  const refreshToken = jwt.sign({ id: user._id, jti, family }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });
  await RefreshToken.create({
    jti, family, userId: user._id,
    userAgent: req.headers['user-agent']?.substring(0, 200),
    ip: req.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    signed: true
  });

  logger.info({ event: '2fa_login_success', userId: user._id, usedBackup, ip: req.ip });
  res.json({
    accessToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, subscription: user.subscription },
    ...(usedBackup ? { warning: 'Backup code used. You have ' + user.twoFactorBackupCodes.length + ' backup codes remaining.' } : {})
  });
});

// ── GET /api/auth/2fa/status ──────────────────────────────────────────────────
exports.get2FAStatus = asyncHandler(async (req, res) => {
  res.json({
    enabled: req.user.twoFactorEnabled || false,
    backupCodesRemaining: req.user.twoFactorBackupCodes?.length || 0
  });
});
