const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-api-key']) {
      // API key auth for enterprise
      const user = await User.findOne({ apiKey: req.headers['x-api-key'] }).select('+apiKey');
      if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid API key' });
      if (!user.subscription.features.apiAccess) return res.status(403).json({ error: 'API access requires Enterprise plan' });
      req.user = user;
      return next();
    }

    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ error: 'User not found or inactive' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Restrict to roles
exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }
  next();
};

// Check subscription plan
exports.requirePlan = (...plans) => (req, res, next) => {
  if (!plans.includes(req.user.subscription.plan)) {
    return res.status(402).json({ error: `This feature requires a ${plans.join(' or ')} subscription`, upgradeRequired: true });
  }
  next();
};

// Check subscription feature flag
exports.requireFeature = (feature) => (req, res, next) => {
  if (!req.user.subscription.features[feature]) {
    return res.status(402).json({ error: `Feature "${feature}" requires a higher subscription plan`, upgradeRequired: true, feature });
  }
  next();
};

// Optional auth - attach user if token exists, don't fail if not
exports.optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch { next(); }
};
