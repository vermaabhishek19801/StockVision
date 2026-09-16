const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { validateRequest } = require('../middleware/validate');

router.post('/register',
  body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  validateRequest,
  authController.register
);

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validateRequest,
  authController.login
);

router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

router.post('/forgot-password',
  body('email').isEmail().normalizeEmail(),
  validateRequest,
  authController.forgotPassword
);

router.patch('/reset-password/:token',
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  validateRequest,
  authController.resetPassword
);

router.post('/register-admin',
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('adminSecret').notEmpty(),
  validateRequest,
  authController.registerAdmin
);

module.exports = router;
