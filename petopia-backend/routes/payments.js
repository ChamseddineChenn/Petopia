/**
 * Payment Routes
 * ==============
 * Secure Stripe integration for Pet Dollar wallet top-ups.
 *
 * FLOW (PaymentIntent + Webhook):
 * ─────────────────────────────────────────────────────────
 *  1. Client selects a top-up amount
 *  2. Client calls POST /api/payments/create-intent → gets clientSecret
 *  3. Client uses Stripe SDK PaymentSheet to collect card & confirm payment
 *  4. Stripe processes payment, sends webhook to POST /api/payments/webhook
 *  5. Webhook handler verifies signature, then atomically credits Pet Dollars
 *
 * SECURITY:
 *  - Credits NEVER issued from client-side confirmation (only webhook)
 *  - Webhook signature verified via STRIPE_WEBHOOK_SECRET
 *  - PaymentIntent metadata carries userId + petDollarAmount for reconciliation
 *  - Idempotency: PaymentIntent ID checked against WalletTransaction to prevent double-credit
 *  - Amount validated server-side (client cannot manipulate the charge amount)
 *  - Rate limited per-user per-day
 *  - Stripe customer objects created per-user for future features (saved cards, refunds)
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { deliverNotification } = require('../services/hybridDelivery');
const {
  getStripe,
  verifyWebhookSignature,
  petDollarsToCents,
  centsToPetDollars,
  calculateTopUpCharge,
  STRIPE_FEE_PERCENT,
} = require('../services/stripeService');

const router = express.Router();

// ─── Rate Limiters ───
const intentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // 15 payment intents per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment attempts, please try again later',
  },
});

// ─── Helper ───
async function notify(recipientId, type, title, body, data = {}) {
  try {
    const notif = await Notification.create({
      recipient: recipientId,
      sender: recipientId,
      type,
      title,
      body,
      data,
    });
    const populated = await Notification.findById(notif._id)
      .populate('sender', 'name profileImage')
      .lean();
    deliverNotification(recipientId.toString(), populated);
  } catch (err) {
    console.error('[Payment] Notification error:', err.message);
  }
}

// ════════════════════════════════════════════════════════════
// POST /api/payments/create-intent
// Create a Stripe PaymentIntent for a wallet top-up
// ════════════════════════════════════════════════════════════
router.post('/create-intent', intentLimiter, protect, async (req, res) => {
  try {
    const { amount } = req.body;

    // ── Validate amount ──
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amount greater than 0',
      });
    }
    if (parsedAmount < 0.5) {
      return res.status(400).json({
        success: false,
        message: 'Minimum top-up amount is P$0.50',
      });
    }
    if (parsedAmount > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum top-up amount is P$10,000 per transaction',
      });
    }

    const petDollarAmount = Math.round(parsedAmount * 100) / 100;

    // ── Calculate fee-inclusive charge ──
    // Buyer absorbs the Stripe processing fee (~3.5%)
    // e.g. 100 P$ → buyer pays ~$103.63
    const charge = calculateTopUpCharge(petDollarAmount);
    const amountInCents = charge.chargeCents;

    const stripe = getStripe();

    // ── Get or create Stripe Customer ──
    // This links the Stripe customer to our user for future features (saved cards, refunds)
    const user = await User.findById(req.user.id).select(
      'email name stripeCustomerId',
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { petopiaUserId: req.user.id },
      });
      customerId = customer.id;
      // Save Stripe customer ID atomically
      await User.findByIdAndUpdate(req.user.id, {
        stripeCustomerId: customerId,
      });
    }

    // ── Create PaymentIntent ──
    // metadata is CRITICAL — the webhook handler uses it to credit the correct user
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: customerId,
      metadata: {
        petopiaUserId: req.user.id,
        petDollarAmount: petDollarAmount.toString(),
        chargeUSD: charge.chargeUSD.toString(),
        feeUSD: charge.feeUSD.toString(),
        purpose: 'wallet_top_up',
      },
      // Restrict payment methods to cards only (no bank transfers, etc.)
      payment_method_types: ['card'],
      // Capture immediately — no separate capture step
      capture_method: 'automatic',
      // Description visible in Stripe Dashboard
      description: `Petopia Wallet Top-Up: P$${petDollarAmount.toFixed(2)} (charged $${charge.chargeUSD.toFixed(2)} incl. fee) for user ${req.user.id}`,
    });

    // Return ONLY the client secret — never expose the full PaymentIntent object
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: petDollarAmount,
      chargeUSD: charge.chargeUSD,
      feeUSD: charge.feeUSD,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (error) {
    console.error('Create payment intent error:', error.message);

    // Differentiate Stripe errors from internal errors
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: 'Payment configuration error. Please try again.',
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/payments/calculate-fee?amount=100
// Calculate the fee-inclusive charge for a top-up amount (no auth required for display)
// ════════════════════════════════════════════════════════════
router.get('/calculate-fee', protect, (req, res) => {
  const amount = parseFloat(req.query.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid amount' });
  }
  const petDollars = Math.round(amount * 100) / 100;
  const charge = calculateTopUpCharge(petDollars);
  res.json({
    success: true,
    petDollars: charge.petDollars,
    chargeUSD: charge.chargeUSD,
    feeUSD: charge.feeUSD,
    feePercent: STRIPE_FEE_PERCENT * 100,
  });
});

// ════════════════════════════════════════════════════════════
// GET /api/payments/config
// Return publishable key for frontend Stripe initialization
// ════════════════════════════════════════════════════════════
router.get('/config', protect, (req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return res
      .status(500)
      .json({ success: false, message: 'Payment system not configured' });
  }
  res.json({
    success: true,
    publishableKey,
  });
});

// ════════════════════════════════════════════════════════════
// GET /api/payments/status/:paymentIntentId
// Check the status of a payment (for client polling fallback)
// ════════════════════════════════════════════════════════════
router.get('/status/:paymentIntentId', protect, async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    // Validate format — PaymentIntent IDs start with "pi_"
    if (
      typeof paymentIntentId !== 'string' ||
      !paymentIntentId.startsWith('pi_')
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid payment ID' });
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Security: verify the PaymentIntent belongs to this user
    if (intent.metadata?.petopiaUserId !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    // Check if we already credited this payment
    const existingTx = await WalletTransaction.findOne({
      'reference.entityId': paymentIntentId,
      'reference.entityType': 'stripe_payment',
    }).lean();

    res.json({
      success: true,
      status: intent.status,
      credited: !!existingTx,
      amount: centsToPetDollars(intent.amount),
    });
  } catch (error) {
    console.error('Payment status error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/payments/webhook
// Stripe webhook handler — THIS IS WHERE MONEY GETS CREDITED
//
// SECURITY:
//  - Raw body required for signature verification (NOT JSON-parsed)
//  - Signature verified against STRIPE_WEBHOOK_SECRET
//  - Idempotent: checks WalletTransaction for duplicate PaymentIntent ID
//  - Only processes 'payment_intent.succeeded' events
//  - Metadata validated before crediting
// ════════════════════════════════════════════════════════════
router.post(
  '/webhook',
  // NOTE: express.raw() is applied in server.js for this route specifically
  // because Stripe needs the raw body buffer for signature verification.
  // The route handler receives req.body as a Buffer.
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      console.warn('[Stripe Webhook] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // ── 1. Verify webhook signature ──
    let event;
    try {
      event = verifyWebhookSignature(req.body, signature);
    } catch (err) {
      console.error(
        '[Stripe Webhook] Signature verification failed:',
        err.message,
      );
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // ── 2. Handle only relevant event types ──
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;

      // Only process wallet top-ups (not other potential future payment types)
      if (paymentIntent.metadata?.purpose !== 'wallet_top_up') {
        console.log(
          `[Stripe Webhook] Ignoring non-top-up payment: ${paymentIntent.id}`,
        );
        return res.json({ received: true });
      }

      const userId = paymentIntent.metadata.petopiaUserId;
      const petDollarAmount = parseFloat(
        paymentIntent.metadata.petDollarAmount,
      );

      // Validate metadata
      if (
        !userId ||
        !Number.isFinite(petDollarAmount) ||
        petDollarAmount <= 0
      ) {
        console.error(
          '[Stripe Webhook] Invalid metadata on payment:',
          paymentIntent.id,
        );
        return res.json({ received: true }); // Acknowledge but don't process
      }

      // ── 3. Idempotency check — prevent double-credit ──
      const existingTx = await WalletTransaction.findOne({
        'reference.entityId': paymentIntent.id,
        'reference.entityType': 'stripe_payment',
      }).lean();

      if (existingTx) {
        console.log(
          `[Stripe Webhook] Already processed payment: ${paymentIntent.id}`,
        );
        return res.json({ received: true });
      }

      // ── 4. Atomically credit the user's wallet ──
      try {
        const user = await User.findByIdAndUpdate(
          userId,
          { $inc: { petDollars: petDollarAmount } },
          { new: true, select: 'petDollars name email' },
        );

        if (!user) {
          console.error(
            `[Stripe Webhook] User not found: ${userId} for payment: ${paymentIntent.id}`,
          );
          // Return 200 so Stripe doesn't retry — user doesn't exist, retrying won't help
          // TODO: flag this for manual review
          return res.json({ received: true });
        }

        // ── 5. Extract rich payment details from Stripe ──
        const latestCharge = paymentIntent.latest_charge;
        // latest_charge may be a string ID or an expanded object depending on API version
        let charge = null;
        if (latestCharge && typeof latestCharge === 'object') {
          charge = latestCharge;
        } else if (latestCharge && typeof latestCharge === 'string') {
          try {
            charge = await getStripe().charges.retrieve(latestCharge);
          } catch (chargeErr) {
            console.warn(
              `[Stripe Webhook] Could not retrieve charge ${latestCharge}:`,
              chargeErr.message,
            );
          }
        }

        const paymentMethodDetails = charge?.payment_method_details;
        const cardDetails = paymentMethodDetails?.card;
        const outcomeDetails = charge?.outcome;
        const balanceTx = charge?.balance_transaction;

        // Try to get Stripe fee from balance transaction
        let stripeFee = null;
        if (balanceTx && typeof balanceTx === 'object') {
          const feeDetail = balanceTx.fee_details?.find(
            (f) => f.type === 'stripe_fee',
          );
          stripeFee = feeDetail?.amount ?? balanceTx.fee ?? null;
        } else if (balanceTx && typeof balanceTx === 'string') {
          try {
            const btx =
              await getStripe().balanceTransactions.retrieve(balanceTx);
            const feeDetail = btx.fee_details?.find(
              (f) => f.type === 'stripe_fee',
            );
            stripeFee = feeDetail?.amount ?? btx.fee ?? null;
          } catch (btxErr) {
            console.warn(
              `[Stripe Webhook] Could not retrieve balance tx:`,
              btxErr.message,
            );
          }
        }

        const stripeDetails = {
          paymentIntentId: paymentIntent.id,
          chargeId: charge?.id || null,
          // Payer info — snapshot from our DB (authoritative) + Stripe billing
          payerName: user.name || charge?.billing_details?.name || null,
          payerEmail: user.email || charge?.billing_details?.email || null,
          // Payment method
          paymentMethodType: paymentMethodDetails?.type || null,
          cardBrand: cardDetails?.brand || null,
          cardLast4: cardDetails?.last4 || null,
          cardExpMonth: cardDetails?.exp_month || null,
          cardExpYear: cardDetails?.exp_year || null,
          cardCountry: cardDetails?.country || null,
          cardFunding: cardDetails?.funding || null,
          // Financial
          amountCharged: paymentIntent.amount,
          currency: paymentIntent.currency,
          stripeFee,
          // Receipt
          receiptUrl: charge?.receipt_url || null,
          receiptEmail:
            charge?.receipt_email || paymentIntent.receipt_email || null,
          // Risk
          riskLevel: outcomeDetails?.risk_level || null,
          riskScore:
            typeof outcomeDetails?.risk_score === 'number'
              ? outcomeDetails.risk_score
              : null,
          stripeStatus: paymentIntent.status,
          // Timestamps
          stripePaidAt: charge?.created
            ? new Date(charge.created * 1000)
            : null,
        };

        // ── 6. Record the transaction with full Stripe details ──
        await WalletTransaction.create({
          user: userId,
          type: 'top_up',
          amount: petDollarAmount,
          balanceAfter: user.petDollars,
          description: `Topped up P$${petDollarAmount.toFixed(2)} via Stripe`,
          reference: {
            entityType: 'stripe_payment',
            entityId: paymentIntent.id,
          },
          stripeDetails,
          status: 'completed',
        });

        // ── 6. Send notification ──
        await notify(
          userId,
          'wallet_top_up',
          'Wallet Topped Up 💰',
          `P$${petDollarAmount.toFixed(2)} has been added to your Pet Dollar wallet. New balance: P$${user.petDollars.toFixed(2)}`,
          { extra: { amount: petDollarAmount, balance: user.petDollars } },
        );

        console.log(
          `[Stripe Webhook] Credited P$${petDollarAmount.toFixed(2)} to user ${userId} (PI: ${paymentIntent.id})`,
        );
      } catch (creditError) {
        console.error(
          `[Stripe Webhook] Credit failed for ${paymentIntent.id}:`,
          creditError.message,
        );
        // Return 500 so Stripe retries the webhook
        return res.status(500).json({ error: 'Credit processing failed' });
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const userId = paymentIntent.metadata?.petopiaUserId;

      if (userId && paymentIntent.metadata?.purpose === 'wallet_top_up') {
        // Notify user that payment failed
        await notify(
          userId,
          'wallet_top_up',
          'Payment Failed',
          'Your wallet top-up payment could not be processed. Please try again with a different payment method.',
          { extra: { paymentIntentId: paymentIntent.id } },
        );
        console.log(
          `[Stripe Webhook] Payment failed for user ${userId}: ${paymentIntent.id}`,
        );
      }
    }

    // Always acknowledge receipt to Stripe
    res.json({ received: true });
  },
);

module.exports = router;
