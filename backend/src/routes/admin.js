const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(protect, restrictTo('admin', 'superadmin'));

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/market-config', adminController.getMarketConfigs);
router.post('/market-config', adminController.upsertMarketConfig);

module.exports = router;
