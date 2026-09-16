const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.use(protect);
router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.patch('/me/password', userController.changePassword);
router.get('/me/api-key', userController.getApiKey);
router.post('/me/api-key', userController.regenerateApiKey);

module.exports = router;
