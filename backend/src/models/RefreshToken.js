const mongoose = require('mongoose');

// Stores active refresh token JTIs. On logout or rotation, the token is deleted.
// On suspicious reuse (old jti presented), the entire family is revoked.
const refreshTokenSchema = new mongoose.Schema({
  jti:       { type: String, required: true, unique: true, index: true },
  family:    { type: String, required: true, index: true }, // for reuse detection
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userAgent: { type: String },
  ip:        { type: String },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } } // TTL index — MongoDB auto-deletes
}, { timestamps: true });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
