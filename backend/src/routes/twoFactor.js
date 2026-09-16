const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const twoFactorController = require('../controllers/twoFactorController');

// All routes require authentication
router.use(protect);

router.get('/status', twoFactorController.get2FAStatus);

router.post('/setup', twoFactorController.setup2FA);

router.post('/verify',
  body('token').trim().notEmpty().withMessage('TOTP token is required'),
  validateRequest,
  twoFactorController.verify2FA
);

router.post('/disable',
  body('token').trim().notEmpty(),
  body('password').notEmpty(),
  validateRequest,
  twoFactorController.disable2FA
);

// Public: called during login challenge (uses tempToken, not session)
router.post('/validate',
  body('tempToken').notEmpty(),
  body('totpToken').trim().notEmpty(),
  validateRequest,
  twoFactorController.validate2FA
);

module.exports = router;
