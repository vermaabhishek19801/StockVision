const User = require('../models/User');
const Watchlist = require('../models/Watchlist');
const Portfolio = require('../models/Portfolio');
const logger = require('../utils/logger');

// GET /api/users/me
exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

// PATCH /api/users/me
exports.updateMe = async (req, res) => {
  try {
    const allowedUpdates = ['name', 'preferences'];
    const updates = {};
    allowedUpdates.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PATCH /api/users/me/password
exports.changePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });
    user.password = req.body.newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET /api/users/me/api-key
exports.getApiKey = async (req, res) => {
  if (!req.user.subscription.features.apiAccess) {
    return res.status(402).json({ error: 'API access requires Enterprise plan' });
  }
  const user = await User.findById(req.user._id).select('+apiKey');
  res.json({ apiKey: user.apiKey || null });
};

// POST /api/users/me/api-key
exports.regenerateApiKey = async (req, res) => {
  if (!req.user.subscription.features.apiAccess) {
    return res.status(402).json({ error: 'API access requires Enterprise plan' });
  }
  const user = await User.findById(req.user._id).select('+apiKey');
  const apiKey = user.generateApiKey();
  await user.save({ validateBeforeSave: false });
  res.json({ apiKey });
};
