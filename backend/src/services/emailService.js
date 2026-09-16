const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || process.env.SMTP_PASS === 'your_sendgrid_api_key') {
    logger.warn('Email service not configured — emails will be logged to console only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
};

const FROM = `"${process.env.FROM_NAME || 'StockVision'}" <${process.env.FROM_EMAIL || 'noreply@stockvision.com'}>`;

// Generic send helper
const sendEmail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  if (!t) {
    // Dev fallback: log to console
    logger.info(`[EMAIL DEV] To: ${to} | Subject: ${subject}`);
    if (text) logger.info(`[EMAIL BODY] ${text}`);
    return;
  }
  await t.sendMail({ from: FROM, to, subject, html, text });
  logger.info({ event: 'email_sent', to, subject });
};

// ── Welcome email ─────────────────────────────────────────────────────────────
const sendWelcomeEmail = async (user) => {
  await sendEmail({
    to: user.email,
    subject: 'Welcome to StockVision!',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#0f1117;color:#e5e7eb;padding:40px;border-radius:8px;">
        <h1 style="color:#3b82d4;margin-bottom:8px;">Welcome, ${user.name}!</h1>
        <p style="margin-bottom:16px;">Your StockVision account is ready. You're on the <strong>Free</strong> plan.</p>
        <p>Log in to track stocks, build portfolios, and get AI-powered predictions.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#3b82d4;color:#fff;border-radius:6px;text-decoration:none;">Go to Dashboard</a>
        <p style="margin-top:32px;font-size:12px;color:#6b7280;">StockVision — AI-powered stock analysis platform</p>
      </div>`,
    text: `Welcome to StockVision, ${user.name}! Log in at ${process.env.FRONTEND_URL}/dashboard`
  });
};

// ── Password reset email ──────────────────────────────────────────────────────
const sendPasswordResetEmail = async (user, resetToken) => {
  const url = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  await sendEmail({
    to: user.email,
    subject: 'StockVision — Reset your password',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#0f1117;color:#e5e7eb;padding:40px;border-radius:8px;">
        <h2 style="color:#3b82d4;">Password Reset Request</h2>
        <p>Hi ${user.name}, we received a request to reset your password.</p>
        <p>Click the button below. This link expires in <strong>1 hour</strong>.</p>
        <a href="${url}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#3b82d4;color:#fff;border-radius:6px;text-decoration:none;">Reset Password</a>
        <p style="margin-top:16px;color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
        <p style="margin-top:8px;font-size:11px;word-break:break-all;color:#4b5563;">Link: ${url}</p>
      </div>`,
    text: `Reset your StockVision password: ${url}\n\nLink expires in 1 hour.`
  });
};

// ── Subscription confirmation ─────────────────────────────────────────────────
const sendSubscriptionEmail = async (user, plan) => {
  const planNames = { free: 'Free', basic: 'Basic (₹299/mo)', pro: 'Pro (₹999/mo)', enterprise: 'Enterprise (₹4,999/mo)' };
  await sendEmail({
    to: user.email,
    subject: `StockVision — Subscription updated to ${planNames[plan] || plan}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#0f1117;color:#e5e7eb;padding:40px;border-radius:8px;">
        <h2 style="color:#3b82d4;">Subscription Updated</h2>
        <p>Hi ${user.name}, your plan has been updated to <strong>${planNames[plan] || plan}</strong>.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#3b82d4;color:#fff;border-radius:6px;text-decoration:none;">Go to Dashboard</a>
      </div>`,
    text: `StockVision subscription updated to ${planNames[plan] || plan}.`
  });
};

// ── 2FA enabled notification ──────────────────────────────────────────────────
const send2FAEnabledEmail = async (user) => {
  await sendEmail({
    to: user.email,
    subject: 'StockVision — Two-Factor Authentication Enabled',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;background:#0f1117;color:#e5e7eb;padding:40px;border-radius:8px;">
        <h2 style="color:#22c55e;">2FA Enabled ✓</h2>
        <p>Hi ${user.name}, Two-Factor Authentication has been enabled on your account.</p>
        <p style="color:#f59e0b;">If you didn't do this, contact support immediately.</p>
      </div>`,
    text: `2FA has been enabled on your StockVision account. If you did not do this, contact support.`
  });
};

module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendSubscriptionEmail, send2FAEnabledEmail };
