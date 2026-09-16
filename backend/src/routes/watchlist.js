const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Watchlist = require('../models/Watchlist');
const { asyncHandler, isValidSymbol } = require('../utils/helpers');

router.use(protect);

// GET all user watchlists — H-4: asyncHandler
router.get('/', asyncHandler(async (req, res) => {
  const lists = await Watchlist.find({ user: req.user._id });
  res.json({ watchlists: lists });
}));

// POST create watchlist — H-1: validate name
router.post('/', asyncHandler(async (req, res) => {
  const name = String(req.body.name || 'Watchlist').trim().substring(0, 100);
  const count = await Watchlist.countDocuments({ user: req.user._id });
  const max = req.user.subscription.features.maxWatchlistItems;
  if (count >= max) return res.status(402).json({ error: 'Watchlist limit reached. Upgrade to add more.' });
  const wl = await Watchlist.create({ user: req.user._id, name });
  res.status(201).json({ watchlist: wl });
}));

// POST add symbol — H-1: validate symbol, exchange, type
router.post('/:id/symbols', asyncHandler(async (req, res) => {
  const wl = await Watchlist.findOne({ _id: req.params.id, user: req.user._id });
  if (!wl) return res.status(404).json({ error: 'Watchlist not found' });

  const symbol = String(req.body.symbol || '').toUpperCase().trim();
  if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol format' });

  const VALID_EXCHANGES = new Set(['NSE', 'BSE', 'NYSE', 'NASDAQ', 'LSE', 'OTHER']);
  const VALID_TYPES = new Set(['stock', 'mutual_fund', 'etf', 'index', 'crypto', 'commodity']);
  const exchange = VALID_EXCHANGES.has(req.body.exchange) ? req.body.exchange : 'OTHER';
  const type     = VALID_TYPES.has(req.body.type) ? req.body.type : 'stock';
  const name     = typeof req.body.name === 'string' ? req.body.name.substring(0, 200) : symbol;

  if (wl.symbols.find(s => s.symbol === symbol)) {
    return res.status(409).json({ error: 'Symbol already in watchlist' });
  }
  wl.symbols.push({ symbol, name, exchange, type });
  await wl.save();
  res.json({ watchlist: wl });
}));

// DELETE symbol — H-1: validate symbol param
router.delete('/:id/symbols/:symbol', asyncHandler(async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase();
  if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol format' });

  const wl = await Watchlist.findOne({ _id: req.params.id, user: req.user._id });
  if (!wl) return res.status(404).json({ error: 'Watchlist not found' });
  wl.symbols = wl.symbols.filter(s => s.symbol !== symbol);
  await wl.save();
  res.json({ watchlist: wl });
}));

// DELETE watchlist — H-4: asyncHandler
router.delete('/:id', asyncHandler(async (req, res) => {
  await Watchlist.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  res.json({ message: 'Watchlist deleted' });
}));

module.exports = router;
