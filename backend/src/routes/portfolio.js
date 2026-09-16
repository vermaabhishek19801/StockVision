const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Portfolio = require('../models/Portfolio');
const { asyncHandler, isValidSymbol } = require('../utils/helpers');

router.use(protect);

// GET portfolios — H-4
router.get('/', asyncHandler(async (req, res) => {
  const portfolios = await Portfolio.find({ user: req.user._id });
  res.json({ portfolios });
}));

// POST create portfolio — H-1: sanitise name
router.post('/', asyncHandler(async (req, res) => {
  const count = await Portfolio.countDocuments({ user: req.user._id });
  if (count >= req.user.subscription.features.maxPortfolios) {
    return res.status(402).json({ error: 'Portfolio limit reached. Upgrade to add more.' });
  }
  const name = String(req.body.name || 'Portfolio').trim().substring(0, 100);
  const currency = ['INR', 'USD', 'EUR', 'GBP'].includes(req.body.currency) ? req.body.currency : 'INR';
  const portfolio = await Portfolio.create({ user: req.user._id, name, currency });
  res.status(201).json({ portfolio });
}));

// POST add transaction — H-1/M-6: full input validation
router.post('/:id/transaction', asyncHandler(async (req, res) => {
  const portfolio = await Portfolio.findOne({ _id: req.params.id, user: req.user._id });
  if (!portfolio) return res.status(404).json({ error: 'Portfolio not found' });

  // M-6: Validate all transaction fields
  const symbol = String(req.body.symbol || '').toUpperCase().trim();
  if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Invalid symbol format' });

  const type = req.body.type === 'sell' ? 'sell' : 'buy';

  const quantity = parseFloat(req.body.quantity);
  if (!isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' });
  }

  const price = parseFloat(req.body.price);
  if (!isFinite(price) || price <= 0) {
    return res.status(400).json({ error: 'Price must be a positive number' });
  }

  const name     = typeof req.body.name === 'string' ? req.body.name.substring(0, 200) : symbol;
  const exchange = typeof req.body.exchange === 'string' ? req.body.exchange.substring(0, 10) : 'NSE';
  const date     = req.body.date ? new Date(req.body.date) : new Date();
  if (isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid date' });

  const existing = portfolio.holdings.find(h => h.symbol === symbol);

  if (type === 'buy') {
    if (existing) {
      const totalQty = existing.quantity + quantity;
      existing.avgBuyPrice = ((existing.avgBuyPrice * existing.quantity) + (price * quantity)) / totalQty;
      existing.quantity    = totalQty;
      existing.totalInvested += price * quantity;
    } else {
      portfolio.holdings.push({
        symbol, name, exchange, type: 'stock',
        quantity, avgBuyPrice: price, totalInvested: price * quantity,
        transactions: [{ type: 'buy', quantity, price, date }]
      });
    }
  } else if (type === 'sell') {
    if (!existing || existing.quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient holdings to sell' });
    }
    existing.quantity      -= quantity;
    existing.totalInvested -= existing.avgBuyPrice * quantity;
    if (existing.quantity === 0) {
      portfolio.holdings = portfolio.holdings.filter(h => h.symbol !== symbol);
    }
  }

  await portfolio.save();
  res.json({ portfolio });
}));

// DELETE portfolio — H-4
router.delete('/:id', asyncHandler(async (req, res) => {
  await Portfolio.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  res.json({ message: 'Portfolio deleted' });
}));

module.exports = router;
