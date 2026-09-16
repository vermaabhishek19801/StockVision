const predictionService = require('../services/predictionService');
const logger = require('../utils/logger');

// POST /api/predict
exports.predict = async (req, res) => {
  try {
    const { symbol, exchange, timeframe = '1m', forceRefresh = false } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    // AI predictions require pro plan
    if (req.user?.subscription?.features?.aiPredictions) {
      // Full AI prediction
    } else if (req.user) {
      // Basic rule-based prediction for free/basic users
    }

    const prediction = await predictionService.predict(
      symbol.toUpperCase(), exchange, timeframe,
      req.user?._id,
      forceRefresh && req.user?.subscription?.features?.aiPredictions
    );

    res.json({ prediction });
  } catch (err) {
    logger.error('Prediction error:', err);
    res.status(500).json({ error: 'Prediction failed' });
  }
};

// GET /api/predict/history/:symbol
exports.predictionHistory = async (req, res) => {
  try {
    const Prediction = require('../models/Prediction');
    const predictions = await Prediction.find({ symbol: req.params.symbol.toUpperCase() })
      .sort('-createdAt').limit(20).select('-rawResponse -inputData');
    res.json({ predictions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
