const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true },
  name: String,
  exchange: String,
  type: { type: String, enum: ['stock', 'mutual_fund', 'etf', 'crypto', 'commodity'], default: 'stock' },
  quantity: { type: Number, required: true, min: 0 },
  avgBuyPrice: { type: Number, required: true, min: 0 },
  totalInvested: { type: Number, required: true },
  transactions: [{
    type: { type: String, enum: ['buy', 'sell'], required: true },
    quantity: Number,
    price: Number,
    date: { type: Date, default: Date.now },
    notes: String
  }]
});

const portfolioSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, default: 'My Portfolio' },
  description: { type: String, maxlength: 500 },
  holdings: [holdingSchema],
  isDefault: { type: Boolean, default: false },
  currency: { type: String, default: 'INR' },
  targetAllocation: [{
    sector: String,
    percentage: Number
  }]
}, { timestamps: true });

portfolioSchema.index({ user: 1 });

portfolioSchema.virtual('totalValue').get(function () {
  return this.holdings.reduce((sum, h) => sum + h.totalInvested, 0);
});

module.exports = mongoose.model('Portfolio', portfolioSchema);
