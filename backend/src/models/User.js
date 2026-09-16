const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  },
  subscription: {
    plan: { type: String, enum: ['free', 'basic', 'pro', 'enterprise'], default: 'free' },
    status: { type: String, enum: ['active', 'inactive', 'cancelled', 'trial'], default: 'active' },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    trialEndsAt: Date,
    currentPeriodEnd: Date,
    features: {
      maxWatchlistItems: { type: Number, default: 10 },
      maxPortfolios: { type: Number, default: 1 },
      aiPredictions: { type: Boolean, default: false },
      advancedCharts: { type: Boolean, default: false },
      realTimeData: { type: Boolean, default: false },
      exportData: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false }
    }
  },
  preferences: {
    currency: { type: String, default: 'INR' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    defaultMarket: { type: String, default: 'NSE' },
    notifications: {
      email: { type: Boolean, default: true },
      priceAlerts: { type: Boolean, default: true },
      news: { type: Boolean, default: false }
    }
  },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, select: false },
  twoFactorBackupCodes: { type: [String], select: false, default: undefined },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  lastLogin: Date,
  lastLoginIP: String,
  isActive: { type: Boolean, default: true },
  apiKey: { type: String, select: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes (email already indexed via unique:true on the field)
userSchema.index({ 'subscription.stripeCustomerId': 1 });
userSchema.index({ apiKey: 1 });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  return await this.updateOne(updates);
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// Generate API key
userSchema.methods.generateApiKey = function () {
  this.apiKey = crypto.randomBytes(32).toString('hex');
  return this.apiKey;
};

// Update subscription features based on plan
userSchema.methods.updateSubscriptionFeatures = function () {
  const planFeatures = {
    free: { maxWatchlistItems: 10, maxPortfolios: 1, aiPredictions: false, advancedCharts: false, realTimeData: false, exportData: false, apiAccess: false },
    basic: { maxWatchlistItems: 50, maxPortfolios: 3, aiPredictions: false, advancedCharts: true, realTimeData: true, exportData: false, apiAccess: false },
    pro: { maxWatchlistItems: 200, maxPortfolios: 10, aiPredictions: true, advancedCharts: true, realTimeData: true, exportData: true, apiAccess: false },
    enterprise: { maxWatchlistItems: 9999, maxPortfolios: 999, aiPredictions: true, advancedCharts: true, realTimeData: true, exportData: true, apiAccess: true }
  };
  this.subscription.features = planFeatures[this.subscription.plan] || planFeatures.free;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
