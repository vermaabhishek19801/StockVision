const express = require('express');
const router = express.Router();
const { protect, optionalAuth, requireFeature } = require('../middleware/auth');
const stockController = require('../controllers/stockController');

// Public routes (with optional auth for rate limits)
router.get('/search', optionalAuth, stockController.search);
router.get('/quote/:symbol', optionalAuth, stockController.getQuote);
router.get('/history/:symbol', optionalAuth, stockController.getHistory);
router.get('/news/:symbol', optionalAuth, stockController.getNews);

// Requires authentication
router.get('/technicals/:symbol', protect, stockController.getTechnicals);
router.get('/fundamentals/:symbol', protect, stockController.getFundamentals);
router.get('/screener', protect, stockController.screener);

module.exports = router;
