/**
 * Stripe Service
 * ==============
 * Centralized Stripe SDK initialization and helpers.
 *
 * Security model:
 *  - NEVER trust client-side payment confirmation
 *  - Credits are ONLY issued via webhook after Stripe confirms payment
 *  - All PaymentIntents carry metadata (userId, petDollarAmount) for reconciliation
 *  - Idempotency keys prevent duplicate charges
 *  - Webhook signature verification prevents spoofed callbacks
 */

const Stripe = require('stripe');

let stripeInstance = null;

/**
 * Lazily initialize the Stripe SDK.
 * Throws if STRIPE_SECRET_KEY is missing.
 */
function getStripe() {
  if (stripeInstance) return stripeInstance;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }

  // Validate key format — must start with sk_test_ or sk_live_
  if (!/^sk_(test|live)_/.test(secretKey)) {
    throw new Error('STRIPE_SECRET_KEY has an invalid format');
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2025-01-27.acacia', // pin API version — prevents breaking changes
    maxNetworkRetries: 2, // retry transient failures
    timeout: 15000, // 15s timeout
  });

  return stripeInstance;
}

/**
 * Verify a Stripe webhook signature.
 * @param {Buffer} rawBody - Raw request body (NOT parsed JSON)
 * @param {string} signature - stripe-signature header value
 * @returns {object} Verified Stripe event
 * @throws {Error} If signature is invalid
 */
function verifyWebhookSignature(rawBody, signature) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
  }

  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/**
 * Pet Dollar exchange rate.
 * 1 CAD = 1 P$ (1:1 for simplicity — adjust as needed)
 */
const PET_DOLLAR_RATE = 1;

/**
 * ─── Fee & Commission Constants ───
 *
 * Financial model:
 *  - Buyer absorbs the Stripe processing fee on wallet top-ups
 *    → e.g. 100 P$ costs the buyer ~$103.50
 *  - At point of sale, the platform takes a 7% commission
 *    → e.g. 100 P$ purchase → seller receives 93 P$, platform keeps 7 P$
 *  - Seller withdrawals are free (platform absorbs Stripe payout fee)
 */
const STRIPE_FEE_PERCENT = 0.035; // 3.5% — Stripe's approximate card processing fee
const STRIPE_FEE_FIXED_CENTS = 0; // $0.00 fixed — simplified (Stripe charges $0.30 but we absorb the difference)
const PLATFORM_COMMISSION_RATE = 0.07; // 7% platform commission at point of sale

/**
 * Calculate the fee-inclusive dollar amount a buyer must pay for a given P$ top-up.
 * Formula: chargeAmount = petDollars / (1 - stripeFeePercent)
 * This ensures the buyer receives the EXACT P$ amount requested after Stripe's cut.
 *
 * @param {number} petDollars - Desired P$ amount
 * @returns {{ chargeCAD: number, chargeCents: number, feeCAD: number, petDollars: number }}
 */
function calculateTopUpCharge(petDollars) {
  // To net exactly `petDollars` worth of CAD after Stripe takes ~3.5%,
  // we charge: amount / (1 - 0.035) = amount * 1.03627...
  // We round UP to the nearest cent to ensure we always cover the fee.
  const grossCAD = (petDollars * PET_DOLLAR_RATE) / (1 - STRIPE_FEE_PERCENT);
  const chargeCAD = Math.ceil(grossCAD * 100) / 100; // round up to nearest cent
  const chargeCents = Math.round(chargeCAD * 100);
  const feeCAD =
    Math.round((chargeCAD - petDollars * PET_DOLLAR_RATE) * 100) / 100;

  return {
    petDollars,
    chargeCAD,
    chargeCents,
    feeCAD,
  };
}

/**
 * Calculate the platform commission split for a purchase.
 *
 * @param {number} totalPetDollars - Total P$ amount of the purchase
 * @returns {{ sellerAmount: number, platformAmount: number, commissionRate: number }}
 */
function calculateCommission(totalPetDollars) {
  const platformAmount =
    Math.round(totalPetDollars * PLATFORM_COMMISSION_RATE * 100) / 100;
  const sellerAmount =
    Math.round((totalPetDollars - platformAmount) * 100) / 100;
  return {
    sellerAmount,
    platformAmount,
    commissionRate: PLATFORM_COMMISSION_RATE,
  };
}

/**
 * Convert a Pet Dollar amount to cents (Stripe's smallest currency unit).
 * @param {number} petDollars - Amount in Pet Dollars
 * @returns {number} Amount in CAD cents
 */
function petDollarsToCents(petDollars) {
  // 1 P$ = 1 CAD → 100 cents
  const cents = Math.round(petDollars * 100 * PET_DOLLAR_RATE);
  if (cents < 50) {
    throw new Error('Minimum charge is $0.50 (Stripe requirement)');
  }
  if (cents > 99999999) {
    throw new Error('Amount exceeds maximum allowed');
  }
  return cents;
}

/**
 * Convert cents back to Pet Dollar amount.
 * @param {number} cents - Amount in CAD cents
 * @returns {number} Amount in Pet Dollars
 */
function centsToPetDollars(cents) {
  return Math.round((cents / 100 / PET_DOLLAR_RATE) * 100) / 100;
}

module.exports = {
  getStripe,
  verifyWebhookSignature,
  petDollarsToCents,
  centsToPetDollars,
  calculateTopUpCharge,
  calculateCommission,
  PET_DOLLAR_RATE,
  STRIPE_FEE_PERCENT,
  PLATFORM_COMMISSION_RATE,
};
