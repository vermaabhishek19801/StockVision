const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 100, default: 'My Watchlist' },
  symbols: [{
    symbol: { type: String, required: true, uppercase: true },
    name: String,
    exchange: { type: String, enum: ['NSE', 'BSE', 'NYSE', 'NASDAQ', 'LSE', 'OTHER'], default: 'NSE' },
    type: { type: String, enum: ['stock', 'mutual_fund', 'etf', 'index', 'crypto', 'commodity'], default: 'stock' },
    alertPrice: { type: Number },
    alertType: { type: String, enum: ['above', 'below'], default: 'above' },
    notes: { type: String, maxlength: 500 },
    addedAt: { type: Date, default: Date.now }
  }],
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

watchlistSchema.index({ user: 1 });
module.exports = mongoose.model('Watchlist', watchlistSchema);
