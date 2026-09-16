const express = require('express');
const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { sendSubscriptionEmail } = require('../services/emailService');
const logger = require('../utils/logger');

// Plan → Stripe price mapping (set these in .env or directly here)
const PLAN_PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC || 'price_basic_monthly',
  pro: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_monthly'
};

// GET /api/subscription/plans
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'free', name: 'Free', price: 0, currency: 'INR', interval: 'month',
        features: ['10 watchlist items', '1 portfolio', 'Basic charts', 'Delayed data (15 min)'],
        badge: null
      },
      {
        id: 'basic', name: 'Basic', price: 299, currency: 'INR', interval: 'month',
        features: ['50 watchlist items', '3 portfolios', 'Advanced charts', 'Real-time data', 'Price alerts'],
        badge: null
      },
      {
        id: 'pro', name: 'Pro', price: 999, currency: 'INR', interval: 'month',
        features: ['200 watchlist items', '10 portfolios', 'AI predictions (WatsonX)', 'Real-time data', 'Data export', 'Technical analysis', 'Full Screener'],
        badge: 'Popular'
      },
      {
        id: 'enterprise', name: 'Enterprise', price: 4999, currency: 'INR', interval: 'month',
        features: ['Unlimited watchlists & portfolios', 'Full AI predictions', 'API access', 'Priority support', 'Custom alerts', 'White-label reports'],
        badge: 'Best Value'
      }
    ]
  });
});

// GET /api/subscription/status
router.get('/status', protect, (req, res) => {
  res.json({ subscription: req.user.subscription });
});

// POST /api/subscription/checkout — create Stripe checkout session
router.post('/checkout', protect, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['basic', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // Dev bypass when Stripe is not configured
    if (!stripe) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(503).json({ error: 'Payment service not configured. Contact admin.' });
      }
      // Dev mode: instant upgrade
      const user = await User.findById(req.user._id);
      user.subscription.plan = plan;
      user.subscription.status = 'active';
      user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      user.updateSubscriptionFeatures();
      await user.save({ validateBeforeSave: false });
      await sendSubscriptionEmail(user, plan).catch(() => {});
      logger.info({ event: 'subscription_dev_upgrade', userId: user._id, plan });
      return res.json({ devMode: true, message: `[DEV] Instantly upgraded to ${plan}`, subscription: user.subscription });
    }

    const priceId = PLAN_PRICE_IDS[plan];
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: req.user.email,
      client_reference_id: req.user._id.toString(),
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: req.user._id.toString(), plan },
      success_url: `${process.env.FRONTEND_URL}/subscription?success=1&plan=${plan}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription?canceled=1`,
      subscription_data: { metadata: { userId: req.user._id.toString(), plan } }
    });

    logger.info({ event: 'stripe_checkout_created', userId: req.user._id, plan, sessionId: session.id });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ event: 'stripe_checkout_error', error: err.message });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/subscription/upgrade (dev-only direct upgrade)
router.post('/upgrade', protect, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Use Stripe checkout to upgrade in production.',
        checkoutUrl: '/api/subscription/checkout'
      });
    }
    const { plan } = req.body;
    const validPlans = ['free', 'basic', 'pro', 'enterprise'];
    if (!validPlans.includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

    const user = await User.findById(req.user._id);
    user.subscription.plan = plan;
    user.subscription.status = 'active';
    user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.updateSubscriptionFeatures();
    await user.save({ validateBeforeSave: false });

    await sendSubscriptionEmail(user, plan).catch(() => {});
    logger.info({ event: 'subscription_upgrade_dev', userId: user._id, plan });
    res.json({ message: `[DEV] Upgraded to ${plan}`, subscription: user.subscription });
  } catch (err) {
    logger.error({ event: 'subscription_upgrade_error', error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/subscription/portal — Stripe customer portal (manage/cancel)
router.post('/portal', protect, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Payment service not configured' });
    if (!req.user.subscription?.stripeCustomerId) {
      return res.status(400).json({ error: 'No active Stripe subscription found' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: req.user.subscription.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/subscription`
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ event: 'stripe_portal_error', error: err.message });
    res.status(500).json({ error: 'Failed to open billing portal' });
  }
});

// POST /api/subscription/webhook — Stripe webhook (raw body required)
// Mounted separately in server.js BEFORE the json() middleware
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe) return res.status(503).send('Stripe not configured');

    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.error({ event: 'stripe_webhook_sig_fail', error: err.message });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const planFromMetadata = async (metadata) => {
      const userId = metadata?.userId;
      const plan = metadata?.plan;
      if (!userId || !plan) return;
      const user = await User.findById(userId);
      if (!user) return;
      return { user, plan };
    };

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const result = await planFromMetadata(session.metadata);
          if (result) {
            const { user, plan } = result;
            user.subscription.plan = plan;
            user.subscription.status = 'active';
            user.subscription.stripeCustomerId = session.customer;
            user.subscription.stripeSubscriptionId = session.subscription;
            user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            user.updateSubscriptionFeatures();
            await user.save({ validateBeforeSave: false });
            await sendSubscriptionEmail(user, plan).catch(() => {});
            logger.info({ event: 'stripe_checkout_fulfilled', userId: user._id, plan });
          }
          break;
        }
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          const subId = invoice.subscription;
          const user = await User.findOne({ 'subscription.stripeSubscriptionId': subId });
          if (user) {
            user.subscription.status = 'active';
            user.subscription.currentPeriodEnd = new Date(invoice.lines?.data?.[0]?.period?.end * 1000 || Date.now() + 30 * 864e5);
            await user.save({ validateBeforeSave: false });
            logger.info({ event: 'stripe_renewal', userId: user._id });
          }
          break;
        }
        case 'invoice.payment_failed':
        case 'customer.subscription.deleted': {
          const obj = event.data.object;
          const subId = obj.subscription || obj.id;
          const user = await User.findOne({ 'subscription.stripeSubscriptionId': subId });
          if (user) {
            user.subscription.status = event.type === 'invoice.payment_failed' ? 'past_due' : 'canceled';
            if (event.type === 'customer.subscription.deleted') {
              user.subscription.plan = 'free';
              user.updateSubscriptionFeatures();
            }
            await user.save({ validateBeforeSave: false });
            logger.info({ event: 'stripe_subscription_event', type: event.type, userId: user._id });
          }
          break;
        }
        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const user = await User.findOne({ 'subscription.stripeSubscriptionId': sub.id });
          if (user) {
            user.subscription.status = sub.status;
            user.subscription.currentPeriodEnd = new Date(sub.current_period_end * 1000);
            await user.save({ validateBeforeSave: false });
          }
          break;
        }
        default:
          logger.debug({ event: 'stripe_unhandled_event', type: event.type });
      }
    } catch (err) {
      logger.error({ event: 'stripe_webhook_handler_error', type: event.type, error: err.message });
    }

    res.json({ received: true });
  }
);

module.exports = router;
