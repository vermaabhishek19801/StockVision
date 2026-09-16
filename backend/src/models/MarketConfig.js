const mongoose = require('mongoose');

const marketConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  label: String,
  exchange: { type: String, enum: ['NSE', 'BSE', 'NYSE', 'NASDAQ', 'LSE', 'OTHER'] },
  baseUrl: String,
  isActive: { type: Boolean, default: true },
  headers: mongoose.Schema.Types.Mixed,
  fetchInterval: { type: Number, default: 30 }, // seconds
  dataProvider: { type: String, enum: ['alpha_vantage', 'finnhub', 'polygon', 'twelve_data', 'yahoo', 'custom'], default: 'yahoo' },
  customEndpoints: {
    quote: String,
    history: String,
    search: String,
    indices: String
  },
  rateLimitPerMinute: { type: Number, default: 60 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('MarketConfig', marketConfigSchema);
