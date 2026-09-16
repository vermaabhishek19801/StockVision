const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  symbol: { type: String, required: true, uppercase: true },
  exchange: String,
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  provider: { type: String, enum: ['watsonx', 'openai', 'internal'], default: 'watsonx' },
  model: String,
  timeframe: { type: String, enum: ['1d', '1w', '1m', '3m', '6m', '1y'], default: '1m' },
  inputData: {
    currentPrice: Number,
    historicalPrices: [Number],
    technicalIndicators: mongoose.Schema.Types.Mixed,
    sentimentScore: Number,
    fundamentals: mongoose.Schema.Types.Mixed
  },
  prediction: {
    direction: { type: String, enum: ['bullish', 'bearish', 'neutral'] },
    targetPrice: Number,
    targetPriceLow: Number,
    targetPriceHigh: Number,
    confidence: Number,
    rationale: String,
    keyFactors: [String],
    riskLevel: { type: String, enum: ['low', 'medium', 'high'] },
    recommendation: { type: String, enum: ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'] }
  },
  rawResponse: mongoose.Schema.Types.Mixed,
  cachedUntil: Date,
  createdAt: { type: Date, default: Date.now }
});

predictionSchema.index({ symbol: 1, createdAt: -1 });
predictionSchema.index({ requestedBy: 1, createdAt: -1 });

module.exports = mongoose.model('Prediction', predictionSchema);
