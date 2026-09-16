const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const yahooFinance = require('../config/yahooFinance');
const stockService = require('../services/stockService');
const { asyncHandler } = require('../utils/helpers');

// GET /api/market/indices
router.get('/indices', asyncHandler(async (req, res) => {
  const indices = await stockService.getIndices();
  res.json({ indices });
}));

// GET /api/market/gainers
router.get('/gainers', protect, asyncHandler(async (req, res) => {
  const result = await yahooFinance.dailyGainers({ count: 25 }).catch(() => null);
  const stocks = (result?.quotes || []).map(q => ({
    symbol: q.symbol, name: q.shortName, price: q.regularMarketPrice,
    changePercent: q.regularMarketChangePercent, volume: q.regularMarketVolume
  }));
  res.json({ stocks });
}));

// GET /api/market/losers
router.get('/losers', protect, asyncHandler(async (req, res) => {
  const result = await yahooFinance.dailyLosers({ count: 25 }).catch(() => null);
  const stocks = (result?.quotes || []).map(q => ({
    symbol: q.symbol, name: q.shortName, price: q.regularMarketPrice,
    changePercent: q.regularMarketChangePercent, volume: q.regularMarketVolume
  }));
  res.json({ stocks });
}));

// GET /api/market/trending
router.get('/trending', asyncHandler(async (req, res) => {
  const result = await yahooFinance.trendingSymbols('IN', { count: 20 }).catch(() => null);
  const symbols = (result?.quotes || []).map(q => ({ symbol: q.symbol }));
  res.json({ symbols });
}));

module.exports = router;
