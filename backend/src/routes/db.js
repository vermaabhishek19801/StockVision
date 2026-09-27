const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const dbController = require('../controllers/dbController');

router.use(protect, restrictTo('admin', 'superadmin'));

router.get('/status',         dbController.getDbStatus);
router.get('/activity',       dbController.getRecentActivity);
router.post('/reset-password', dbController.resetUserPassword);
router.post('/unlock',         dbController.unlockAccount);

module.exports = router;
