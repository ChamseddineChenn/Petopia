/**
 * Payout Routes (Stripe Connect)
 * ===============================
 * Allows service providers (vet, groomer, pet_shop) to withdraw P$ to their
 * bank account or debit card via Stripe Connect Express.
 *
 * FLOW:
 * ─────────────────────────────────────────────────────
 *  1. Provider calls POST /api/payouts/onboard → gets Stripe-hosted onboarding URL
 *  2. Provider completes KYC on Stripe's page → redirected back to app
 *  3. Provider calls GET  /api/payouts/status  → check if payouts enabled
 *  4. Provider calls POST /api/payouts/withdraw → deducts P$, transfers real CAD
 *
 * PAYOUT OPTIONS:
 *  - Standard (bank account): FREE, arrives in 2 business days
 *  - Instant  (debit card):   1% fee (min $0.50 CAD), arrives in minutes
 *
 * SECURITY:
 *  - Only service providers can access these routes (vet, groomer, pet_shop)
 *  - Atomic balance deduction prevents double-withdraw
 *  - All transfers go through Stripe Connect — platform never handles bank details
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Notification = require('../models/Notification');
const { protect, restrictTo } = require('../middleware/auth');
const { deliverNotification } = require('../services/hybridDelivery');
const { getStripe, PET_DOLLAR_RATE } = require('../services/stripeService');

const router = express.Router();

const SERVICE_ROLES = ['vet', 'groomer', 'pet_shop'];

// Rate limiters
const onboardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many onboarding attempts' },
});

const withdrawLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many withdrawal attempts today' },
});

// ── Helper ──
async function notify(recipientId, type, title, body, data = {}) {
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
}

// ════════════════════════════════════════
// POST /api/payouts/onboard — Create/refresh Stripe Connect onboarding link
// ════════════════════════════════════════
router.post(
  '/onboard',
  onboardLimiter,
  protect,
  restrictTo(...SERVICE_ROLES),
  async (req, res) => {
    try {
      const stripe = getStripe();
      const user = await User.findById(req.user.id)
        .select('+stripeConnectAccountId name email')
        .lean();

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found' });
      }

      let accountId = user.stripeConnectAccountId;

      // Validate existing account still exists on Stripe
      if (accountId) {
        try {
          await stripe.accounts.retrieve(accountId);
        } catch (checkErr) {
          if (
            checkErr.code === 'account_invalid' ||
            checkErr.statusCode === 403
          ) {
            console.log(
              `Stale Connect account ${accountId} — clearing and creating fresh`,
            );
            await User.findByIdAndUpdate(req.user.id, {
              $unset: { stripeConnectAccountId: 1 },
            });
            accountId = null;
          } else {
            throw checkErr;
          }
        }
      }

      // Use US in test mode (instant payouts require US in test), CA in production
      const stripeCountry = process.env.STRIPE_SECRET_KEY?.startsWith(
        'sk_test_',
      )
        ? 'US'
        : 'CA';

      // Create a new Express account if none exists
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: stripeCountry,
          email: user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
          metadata: {
            userId: req.user.id,
            platform: 'petopia',
          },
        });

        accountId = account.id;

        await User.findByIdAndUpdate(req.user.id, {
          stripeConnectAccountId: accountId,
        });
      }

      // Check if account already completed onboarding
      const existingAccount = await stripe.accounts.retrieve(accountId);

      if (
        existingAccount.details_submitted &&
        (!existingAccount.requirements?.currently_due?.length ||
          existingAccount.requirements.currently_due.length === 0)
      ) {
        // Details submitted & no pending requirements — just return status
        return res.json({
          success: true,
          alreadyComplete: true,
          accountId,
          payoutsEnabled: existingAccount.payouts_enabled || false,
          chargesEnabled: existingAccount.charges_enabled || false,
          detailsSubmitted: true,
        });
      }

      // Generate an account link for onboarding / updating
      // Stripe requires https:// URLs, so we use backend redirect endpoints
      const baseUrl = process.env.SERVER_URL || `http://192.168.1.116:5000`;
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/api/payouts/connect-refresh`,
        return_url: `${baseUrl}/api/payouts/connect-return`,
        type: 'account_onboarding',
      });

      res.json({
        success: true,
        url: accountLink.url,
        accountId,
      });
    } catch (error) {
      console.error('Payout onboard error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create onboarding link',
      });
    }
  },
);

// ════════════════════════════════════════
// GET /api/payouts/status — Check Connect account status
// ════════════════════════════════════════
router.get(
  '/status',
  protect,
  restrictTo(...SERVICE_ROLES),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id)
        .select('+stripeConnectAccountId petDollars')
        .lean();

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found' });
      }

      if (!user.stripeConnectAccountId) {
        return res.json({
          success: true,
          connected: false,
          payoutsEnabled: false,
          balance: user.petDollars,
        });
      }

      const stripe = getStripe();
      let account;
      try {
        account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
      } catch (stripeErr) {
        if (
          stripeErr.code === 'account_invalid' ||
          stripeErr.statusCode === 403
        ) {
          // Account was deleted from Stripe — clear stale ID
          await User.findByIdAndUpdate(req.user.id, {
            $unset: { stripeConnectAccountId: 1 },
          });
          return res.json({
            success: true,
            connected: false,
            payoutsEnabled: false,
            balance: user.petDollars,
          });
        }
        throw stripeErr;
      }

      // Determine external account info (bank / card)
      let externalAccount = null;
      let hasDebitCard = false;
      if (account.external_accounts?.data?.length > 0) {
        const ext = account.external_accounts.data[0];
        if (ext.object === 'bank_account') {
          externalAccount = {
            type: 'bank_account',
            bankName: ext.bank_name,
            last4: ext.last4,
            currency: ext.currency,
          };
        } else if (ext.object === 'card') {
          externalAccount = {
            type: 'card',
            brand: ext.brand,
            last4: ext.last4,
          };
          hasDebitCard = true;
        }
        // Check all external accounts for a debit card
        for (const ea of account.external_accounts.data) {
          if (ea.object === 'card') {
            hasDebitCard = true;
            break;
          }
        }
      }

      res.json({
        success: true,
        connected: true,
        payoutsEnabled: account.payouts_enabled || false,
        chargesEnabled: account.charges_enabled || false,
        detailsSubmitted: account.details_submitted || false,
        requiresAction:
          account.requirements?.currently_due?.length > 0 || false,
        currentlyDue: account.requirements?.currently_due || [],
        externalAccount,
        instantAvailable: hasDebitCard,
        balance: user.petDollars,
      });
    } catch (error) {
      console.error('Payout status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check payout status',
      });
    }
  },
);

// ════════════════════════════════════════
// POST /api/payouts/withdraw — Withdraw P$ to bank/card
// ════════════════════════════════════════
router.post(
  '/withdraw',
  withdrawLimiter,
  protect,
  restrictTo(...SERVICE_ROLES),
  async (req, res) => {
    let withdrawAmount = 0;
    let balanceDeducted = false;
    let transferSucceeded = false;

    try {
      const { amount, method } = req.body; // method: 'standard' or 'instant'

      const parsedAmount = parseFloat(amount);
      if (!parsedAmount || parsedAmount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum withdrawal is P$5.00',
        });
      }
      if (parsedAmount > 50000) {
        return res.status(400).json({
          success: false,
          message: 'Maximum withdrawal is P$50,000.00',
        });
      }

      withdrawAmount = Math.round(parsedAmount * 100) / 100;
      const payoutMethod = method === 'instant' ? 'instant' : 'standard';

      // Calculate fee
      let fee = 0;
      if (payoutMethod === 'instant') {
        fee = Math.max(withdrawAmount * 0.01, 0.5); // 1%, min $0.50
        fee = Math.round(fee * 100) / 100;
      }

      const netAmount = Math.round((withdrawAmount - fee) * 100) / 100;

      // Get user with Connect account
      const user = await User.findById(req.user.id)
        .select('+stripeConnectAccountId petDollars')
        .lean();

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found' });
      }

      if (!user.stripeConnectAccountId) {
        return res.status(400).json({
          success: false,
          message: 'Please complete bank account setup first',
        });
      }

      if (user.petDollars < withdrawAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. You have P$${user.petDollars.toFixed(2)} but requested P$${withdrawAmount.toFixed(2)}`,
        });
      }

      // Verify payouts are enabled on the Connect account
      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(
        user.stripeConnectAccountId,
      );

      if (!account.payouts_enabled) {
        return res.status(400).json({
          success: false,
          message:
            'Payouts are not yet enabled on your account. Please complete verification.',
        });
      }

      // Atomic balance deduction
      const updatedUser = await User.findOneAndUpdate(
        { _id: req.user.id, petDollars: { $gte: withdrawAmount } },
        { $inc: { petDollars: -withdrawAmount } },
        { new: true, select: 'petDollars' },
      );

      if (!updatedUser) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance or concurrent transaction',
        });
      }

      balanceDeducted = true;

      // Transfer real CAD to their Connect account
      // Net amount (after instant fee if applicable) converted to cents
      const transferCents = Math.round(netAmount * 100 * PET_DOLLAR_RATE);

      // Check platform available balance and pick the best currency
      const platformBalance = await stripe.balance.retrieve();
      const cadAvail = platformBalance.available.find(
        (b) => b.currency === 'cad',
      );
      const usdAvail = platformBalance.available.find(
        (b) => b.currency === 'usd',
      );
      const cadAmount = cadAvail?.amount || 0;
      const usdAmount = usdAvail?.amount || 0;

      console.log(
        `Platform available balance — CAD: $${(cadAmount / 100).toFixed(2)}, USD: $${(usdAmount / 100).toFixed(2)}, Transfer needs: $${(transferCents / 100).toFixed(2)}`,
      );

      // Use CAD if enough available, otherwise fall back to USD (Stripe auto-converts)
      let transferCurrency = 'cad';
      if (cadAmount < transferCents && usdAmount >= transferCents) {
        transferCurrency = 'usd';
      }

      // If neither currency has enough available, tell the user
      if (cadAmount < transferCents && usdAmount < transferCents) {
        // Rollback
        await User.findByIdAndUpdate(req.user.id, {
          $inc: { petDollars: withdrawAmount },
        });
        return res.status(400).json({
          success: false,
          message:
            'Withdrawal temporarily unavailable. Your funds may still be settling (takes ~2 business days). Please try again later or contact support.',
        });
      }

      let transfer;
      try {
        transfer = await stripe.transfers.create({
          amount: transferCents,
          currency: transferCurrency,
          destination: user.stripeConnectAccountId,
          description: `Petopia withdrawal — P$${withdrawAmount.toFixed(2)}`,
          metadata: {
            userId: req.user.id,
            petDollarAmount: withdrawAmount,
            method: payoutMethod,
            fee: fee,
          },
        });
        transferSucceeded = true;
      } catch (stripeErr) {
        // Rollback — refund the P$ deduction
        await User.findByIdAndUpdate(req.user.id, {
          $inc: { petDollars: withdrawAmount },
        });
        balanceDeducted = false;
        console.error('Stripe transfer error:', stripeErr);

        let userMessage =
          'Transfer to your bank failed. Your balance has been restored.';
        if (
          stripeErr.message?.includes('insufficient') ||
          stripeErr.code === 'balance_insufficient'
        ) {
          userMessage =
            'The platform Stripe balance is insufficient for this transfer. Please try a smaller amount or wait for funds to settle.';
        }

        return res.status(500).json({
          success: false,
          message: userMessage,
        });
      }

      // If instant, trigger an immediate payout from the Connect account
      if (payoutMethod === 'instant') {
        try {
          await stripe.payouts.create(
            {
              amount: transferCents,
              currency: transferCurrency,
              method: 'instant',
            },
            { stripeAccount: user.stripeConnectAccountId },
          );
        } catch (instantErr) {
          // Instant payout failed — the money is still in their Stripe balance
          // It will auto-payout on standard schedule, so we don't rollback
          console.error('Instant payout failed:', instantErr.message);
        }
      }

      // Record the transaction
      const transaction = await WalletTransaction.create({
        user: req.user.id,
        type: 'withdrawal',
        amount: -withdrawAmount,
        balanceAfter: updatedUser.petDollars,
        description:
          payoutMethod === 'instant'
            ? `Instant withdrawal — P$${withdrawAmount.toFixed(2)} (Fee: P$${fee.toFixed(2)})`
            : `Withdrawal — P$${withdrawAmount.toFixed(2)} (Free, 2 business days)`,
        reference: {
          entityType: 'withdrawal',
          entityId: transfer.id,
        },
        stripeDetails: {
          paymentIntentId: transfer.id,
          amountCharged: transferCents,
          currency: transferCurrency,
          stripeFee: payoutMethod === 'instant' ? Math.round(fee * 100) : 0,
          stripeStatus: 'succeeded',
        },
        status: 'completed',
      });

      // Notify
      try {
        await notify(
          req.user.id,
          'wallet',
          payoutMethod === 'instant'
            ? 'Instant Withdrawal Sent 💸'
            : 'Withdrawal Processing 🏦',
          payoutMethod === 'instant'
            ? `P$${withdrawAmount.toFixed(2)} has been sent to your debit card (Fee: P$${fee.toFixed(2)}).`
            : `P$${withdrawAmount.toFixed(2)} is being transferred to your bank account. Expected in 2 business days.`,
          { amount: withdrawAmount, method: payoutMethod, fee },
        );
      } catch (e) {
        console.error('Withdrawal notification error:', e.message);
      }

      res.json({
        success: true,
        message:
          payoutMethod === 'instant'
            ? `P$${withdrawAmount.toFixed(2)} sent to your card instantly! (Fee: P$${fee.toFixed(2)})`
            : `P$${withdrawAmount.toFixed(2)} withdrawal initiated. Arrives in 2 business days.`,
        balance: updatedUser.petDollars,
        transaction,
        transfer: {
          id: transfer.id,
          amount: netAmount,
          fee,
          method: payoutMethod,
          currency: transferCurrency,
        },
      });
    } catch (error) {
      console.error('Withdrawal error:', error);

      // Rollback P$ if deducted but transfer didn't go through
      if (balanceDeducted && !transferSucceeded) {
        try {
          await User.findByIdAndUpdate(req.user.id, {
            $inc: { petDollars: withdrawAmount },
          });
          console.log('Rolled back P$ deduction after withdrawal error');
        } catch (rollbackErr) {
          console.error(
            'CRITICAL: Failed to rollback P$ deduction:',
            rollbackErr,
          );
        }
      }

      res.status(500).json({
        success: false,
        message: transferSucceeded
          ? 'Withdrawal transferred but failed to record transaction. Please contact support.'
          : 'Withdrawal failed. Your balance has been restored. Please try again.',
      });
    }
  },
);

// ════════════════════════════════════════
// GET /api/payouts/dashboard — Get Stripe Express dashboard link
// ════════════════════════════════════════
router.get(
  '/dashboard',
  protect,
  restrictTo(...SERVICE_ROLES),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id)
        .select('+stripeConnectAccountId')
        .lean();

      if (!user?.stripeConnectAccountId) {
        return res.status(400).json({
          success: false,
          message: 'No connected account found',
        });
      }

      const stripe = getStripe();
      const loginLink = await stripe.accounts.createLoginLink(
        user.stripeConnectAccountId,
      );

      res.json({
        success: true,
        url: loginLink.url,
      });
    } catch (error) {
      console.error('Dashboard link error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate dashboard link',
      });
    }
  },
);

// ─── Redirect endpoints for Stripe Connect onboarding ──────────
// Stripe requires real https/http URLs. These pages show a simple
// "you can go back to the app" message after onboarding completes.

router.get('/connect-return', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Petopia - Setup Complete</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #FAFAF7; color: #1F2937; }
          .card { text-align: center; padding: 40px; max-width: 400px; }
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { font-size: 22px; margin-bottom: 8px; }
          p { color: #6B7280; font-size: 14px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">&#10003;</div>
          <h1>Setup Complete!</h1>
          <p>Your bank account has been connected successfully. You can close this page and return to the Petopia app to start withdrawing your earnings.</p>
        </div>
      </body>
    </html>
  `);
});

router.get('/connect-refresh', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Petopia - Try Again</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #FAFAF7; color: #1F2937; }
          .card { text-align: center; padding: 40px; max-width: 400px; }
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { font-size: 22px; margin-bottom: 8px; }
          p { color: #6B7280; font-size: 14px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">&#8634;</div>
          <h1>Session Expired</h1>
          <p>The setup link has expired. Please close this page, go back to the Petopia app, and tap "Connect Bank Account" again to get a fresh link.</p>
        </div>
      </body>
    </html>
  `);
});

// ─── DEV ONLY: Reset Connect account for testing ──────────
router.delete(
  '/reset-connect',
  protect,
  restrictTo(...SERVICE_ROLES),
  async (req, res) => {
    try {
      // Block in production — dev/test only
      if (
        process.env.NODE_ENV === 'production' ||
        !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')
      ) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      const user = await User.findById(req.user.id)
        .select('+stripeConnectAccountId')
        .lean();

      if (user?.stripeConnectAccountId) {
        // Try to delete the Stripe account
        try {
          const stripe = getStripe();
          await stripe.accounts.del(user.stripeConnectAccountId);
        } catch (e) {
          console.log(
            'Could not delete Stripe account (may already be deleted):',
            e.message,
          );
        }
      }

      // Clear from DB
      await User.findByIdAndUpdate(req.user.id, {
        $unset: { stripeConnectAccountId: 1 },
      });

      res.json({
        success: true,
        message: 'Connect account reset. You can reconnect fresh.',
      });
    } catch (error) {
      console.error('Reset connect error:', error);
      res.status(500).json({ success: false, message: 'Failed to reset' });
    }
  },
);

// ─── DEV ONLY: Force-verify Connect account in test mode ──────────
router.post(
  '/dev-verify',
  protect,
  restrictTo(...SERVICE_ROLES),
  async (req, res) => {
    try {
      // Block in production — dev/test only
      if (
        process.env.NODE_ENV === 'production' ||
        !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')
      ) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      const stripe = getStripe();

      const user = await User.findById(req.user.id)
        .select('+stripeConnectAccountId')
        .lean();

      if (!user?.stripeConnectAccountId) {
        return res.status(400).json({
          success: false,
          message:
            'No Connect account found. Tap "Connect Bank Account" first.',
        });
      }

      const accountId = user.stripeConnectAccountId;

      // Check what's currently due
      const account = await stripe.accounts.retrieve(accountId);
      const due = account.requirements?.currently_due || [];
      console.log('Currently due requirements:', due);

      // Minimal valid 1x1 pixel PNG (67 bytes)
      const TINY_PNG = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );

      // Upload a test identity document file
      const testFile = await stripe.files.create(
        {
          purpose: 'identity_document',
          file: {
            data: TINY_PNG,
            name: 'test_id.png',
            type: 'image/png',
          },
        },
        {
          stripeAccount: accountId,
        },
      );

      const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
      const devCountry = isTestMode ? 'US' : 'CA';
      const devCurrency = isTestMode ? 'usd' : 'cad';

      // Build update payload to satisfy all common requirements
      const updatePayload = {
        individual: {
          first_name: account.individual?.first_name || 'Test',
          last_name: account.individual?.last_name || 'User',
          dob: account.individual?.dob?.year
            ? undefined
            : { day: 1, month: 1, year: 1990 },
          address: isTestMode
            ? {
                line1: '123 Test Street',
                city: 'New York',
                state: 'NY',
                postal_code: '10001',
                country: 'US',
              }
            : {
                line1: '123 Test Street',
                city: 'Toronto',
                state: 'ON',
                postal_code: 'M5V 2T6',
                country: 'CA',
              },
          id_number: isTestMode ? '000000000' : '000000000', // SSN (US) or SIN (CA)
          verification: {
            document: { front: testFile.id },
            additional_document: { front: testFile.id },
          },
        },
        business_profile: {
          mcc: '7299',
          url: 'https://petopia.app',
        },
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip: req.ip || '127.0.0.1',
        },
      };

      // Remove undefined fields
      if (!updatePayload.individual.dob) {
        delete updatePayload.individual.dob;
      }

      await stripe.accounts.update(accountId, updatePayload);

      // Also add a test external account (bank) if none exists
      if (!account.external_accounts?.data?.length) {
        try {
          await stripe.accounts.createExternalAccount(accountId, {
            external_account: isTestMode
              ? {
                  object: 'bank_account',
                  country: 'US',
                  currency: 'usd',
                  routing_number: '110000000', // Stripe test routing number for US
                  account_number: '000123456789',
                }
              : {
                  object: 'bank_account',
                  country: 'CA',
                  currency: 'cad',
                  routing_number: '11000-000', // Stripe test routing number for CA
                  account_number: '000123456789',
                },
          });
        } catch (bankErr) {
          console.log('Could not add test bank account:', bankErr.message);
        }
      }

      // Re-fetch to see updated status
      const updated = await stripe.accounts.retrieve(accountId);

      res.json({
        success: true,
        message: 'Account force-verified for testing',
        payoutsEnabled: updated.payouts_enabled,
        chargesEnabled: updated.charges_enabled,
        detailsSubmitted: updated.details_submitted,
        remainingRequirements: updated.requirements?.currently_due || [],
      });
    } catch (error) {
      console.error('Dev verify error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to force-verify',
      });
    }
  },
);

// ─── DEV ONLY: Add test debit card for instant payouts ──────────
router.post(
  '/dev-add-debit-card',
  protect,
  restrictTo(...SERVICE_ROLES),
  async (req, res) => {
    try {
      // Block in production — dev/test only
      if (
        process.env.NODE_ENV === 'production' ||
        !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')
      ) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      const stripe = getStripe();

      const user = await User.findById(req.user.id)
        .select('+stripeConnectAccountId')
        .lean();

      if (!user?.stripeConnectAccountId) {
        return res.status(400).json({
          success: false,
          message: 'No Connect account found. Complete onboarding first.',
        });
      }

      const accountId = user.stripeConnectAccountId;

      // Express connected accounts don't allow adding debit cards via API
      // (tok_visa_debit and raw card numbers are both blocked).
      // Instead, add a test bank account using Stripe's official test numbers.
      // This enables standard payouts for testing. Instant payouts (debit card)
      // can only be configured through Stripe's hosted onboarding in production.
      const bankAccount = await stripe.accounts.createExternalAccount(
        accountId,
        {
          external_account: {
            object: 'bank_account',
            country: 'US',
            currency: 'usd',
            routing_number: '110000000',
            account_number: '000123456789',
          },
        },
      );

      res.json({
        success: true,
        message: `Test bank account linked: ${bankAccount.bank_name} ••••${bankAccount.last4}`,
        bankAccount: {
          id: bankAccount.id,
          bank_name: bankAccount.bank_name,
          last4: bankAccount.last4,
          status: bankAccount.status,
        },
      });
    } catch (error) {
      console.error('Dev add debit card error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add test debit card',
      });
    }
  },
);

// ─── DEV ONLY: Seed platform available balance for testing ──────────
router.post(
  '/dev-seed-balance',
  protect,
  restrictTo(...SERVICE_ROLES),
  async (req, res) => {
    try {
      // Block in production — dev/test only
      if (
        process.env.NODE_ENV === 'production' ||
        !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')
      ) {
        return res.status(404).json({ success: false, message: 'Not found' });
      }

      const stripe = getStripe();

      const amount = Math.round((parseFloat(req.body.amount) || 1000) * 100);
      const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
      const seedCurrency = isTestMode ? 'usd' : 'cad';

      // Create a charge using Stripe's test token that puts funds directly
      // into available balance (bypasses pending period)
      const charge = await stripe.charges.create({
        amount,
        currency: seedCurrency,
        source: 'tok_bypassPending', // Stripe test token — funds go straight to available
        description:
          'DEV: Seed platform available balance for testing withdrawals',
      });

      // Check the resulting balance
      const balance = await stripe.balance.retrieve();
      const available = balance.available.find(
        (b) => b.currency === seedCurrency,
      );
      const pending = balance.pending.find((b) => b.currency === seedCurrency);

      res.json({
        success: true,
        message: `Seeded $${(amount / 100).toFixed(2)} ${seedCurrency.toUpperCase()} into available balance`,
        chargeId: charge.id,
        available: available ? (available.amount / 100).toFixed(2) : '0.00',
        pending: pending ? (pending.amount / 100).toFixed(2) : '0.00',
      });
    } catch (error) {
      console.error('Dev seed balance error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to seed balance',
      });
    }
  },
);

module.exports = router;
