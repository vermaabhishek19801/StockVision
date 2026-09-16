const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const predictionController = require('../controllers/predictionController');

router.post('/', optionalAuth, predictionController.predict);
router.get('/history/:symbol', protect, predictionController.predictionHistory);

module.exports = router;
