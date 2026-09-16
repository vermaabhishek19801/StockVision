const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const MarketConfig = require('../models/MarketConfig');

// GET public config (active exchanges)
router.get('/exchanges', async (req, res) => {
  const configs = await MarketConfig.find({ isActive: true }).select('key label exchange dataProvider');
  res.json({ exchanges: configs });
});

// Admin-only config management
router.use(protect, restrictTo('admin', 'superadmin'));

router.get('/', async (req, res) => {
  const configs = await MarketConfig.find();
  res.json({ configs });
});

router.post('/', async (req, res) => {
  try {
    const config = await MarketConfig.findOneAndUpdate(
      { key: req.body.key },
      { ...req.body, updatedBy: req.user._id },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ config });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:key', async (req, res) => {
  await MarketConfig.findOneAndDelete({ key: req.params.key });
  res.json({ message: 'Config deleted' });
});

module.exports = router;
