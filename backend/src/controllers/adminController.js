const User = require('../models/User');
const Prediction = require('../models/Prediction');
const MarketConfig = require('../models/MarketConfig');
const RefreshToken = require('../models/RefreshToken');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/helpers');

// Escape regex metacharacters — M-4
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').substring(0, 100);

// GET /api/admin/users — L-3: cap limit, M-4: escape regex
exports.getAllUsers = asyncHandler(async (req, res) => {
  const page  = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100); // L-3: capped
  const search = String(req.query.search || '').trim();
  const plan = req.query.plan;
  const role = req.query.role;

  const filter = {};
  if (search) {
    const safe = escapeRegex(search); // M-4: prevent ReDoS
    filter.$or = [{ name: new RegExp(safe, 'i') }, { email: new RegExp(safe, 'i') }];
  }
  if (['free', 'basic', 'pro', 'enterprise'].includes(plan)) filter['subscription.plan'] = plan;
  if (['user', 'admin'].includes(role)) filter.role = role; // H-5: superadmin not filterable

  const [users, total] = await Promise.all([
    User.find(filter).select('-password -twoFactorSecret -apiKey').skip((page - 1) * limit).limit(limit).sort('-createdAt'),
    User.countDocuments(filter)
  ]);

  res.json({ users, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/admin/users/:id
exports.getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -twoFactorSecret -apiKey');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// PATCH /api/admin/users/:id — H-5: prevent privilege escalation
exports.updateUser = asyncHandler(async (req, res) => {
  // H-5: Prevent self-update via admin endpoint
  if (req.params.id === String(req.user._id)) {
    return res.status(403).json({ error: 'Admins cannot modify their own account via this endpoint' });
  }

  const allowedUpdates = ['name', 'isActive', 'subscription'];
  const updates = {};
  allowedUpdates.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  // H-5: Role changes — admins can only set 'user' or 'admin'; only superadmin can set 'admin'
  if (req.body.role !== undefined) {
    const requestingRole = req.user.role;
    const targetRole = req.body.role;
    const allowedTargetRoles = requestingRole === 'superadmin' ? ['user', 'admin'] : ['user'];
    if (!allowedTargetRoles.includes(targetRole)) {
      return res.status(403).json({ error: `Your role (${requestingRole}) cannot set role to '${targetRole}'` });
    }
    updates.role = targetRole;
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password -twoFactorSecret -apiKey');
  if (!user) return res.status(404).json({ error: 'User not found' });

  logger.info({ event: 'admin_user_update', adminId: req.user._id, targetId: user._id, updates: Object.keys(updates) });
  res.json({ user });
});

// DELETE /api/admin/users/:id (soft delete)
exports.deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) {
    return res.status(403).json({ error: 'Cannot deactivate your own account' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Revoke all sessions for deactivated user
  await RefreshToken.deleteMany({ userId: req.params.id });
  logger.warn({ event: 'admin_user_deactivated', adminId: req.user._id, targetId: user._id });
  res.json({ message: 'User deactivated and all sessions revoked' });
});

// GET /api/admin/stats
exports.getStats = asyncHandler(async (req, res) => {
  const [totalUsers, activeUsers, freeUsers, basicUsers, proUsers, enterpriseUsers, todayLogins, totalPredictions] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ 'subscription.plan': 'free' }),
    User.countDocuments({ 'subscription.plan': 'basic' }),
    User.countDocuments({ 'subscription.plan': 'pro' }),
    User.countDocuments({ 'subscription.plan': 'enterprise' }),
    User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    Prediction.countDocuments()
  ]);
  res.json({
    users: { total: totalUsers, active: activeUsers },
    subscriptions: { free: freeUsers, basic: basicUsers, pro: proUsers, enterprise: enterpriseUsers },
    activity: { todayLogins, totalPredictions }
  });
});

exports.getMarketConfigs = asyncHandler(async (req, res) => {
  const configs = await MarketConfig.find();
  res.json({ configs });
});

exports.upsertMarketConfig = asyncHandler(async (req, res) => {
  const config = await MarketConfig.findOneAndUpdate(
    { key: req.body.key },
    { ...req.body, updatedBy: req.user._id },
    { new: true, upsert: true, runValidators: true }
  );
  logger.info({ event: 'market_config_updated', adminId: req.user._id, key: req.body.key });
  res.json({ config });
});
