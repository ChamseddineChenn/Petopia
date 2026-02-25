const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { deliverNotification } = require('../services/hybridDelivery');
const { calculateCommission } = require('../services/stripeService');

// Rate limiters for financial endpoints
const topUpLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 top-ups per day
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many top-up attempts, please try again later',
  },
});

const spendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 spend operations per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many transactions, please try again later',
  },
});

// ════════════════════════════════════════
// Helper — send a notification + real-time push
// ════════════════════════════════════════
async function notify(recipientId, type, title, body, data = {}) {
  const notif = await Notification.create({
    recipient: recipientId,
    sender: recipientId, // wallet notifications are self-generated
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
// GET /api/wallet — Get balance + recent transactions
// ════════════════════════════════════════
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('petDollars');
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      WalletTransaction.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments({ user: req.user.id }),
    ]);

    res.json({
      success: true,
      balance: user.petDollars,
      transactions,
      pagination: {
        page,
        pages: Math.ceil(total / limit) || 1,
        total,
      },
    });
  } catch (error) {
    console.error('Wallet get error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ════════════════════════════════════════
// GET /api/wallet/balance — Quick balance check
// ════════════════════════════════════════
router.get('/balance', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('petDollars');
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, balance: user.petDollars });
  } catch (error) {
    console.error('Wallet balance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ════════════════════════════════════════
// POST /api/wallet/top-up — DEPRECATED (use /api/payments/create-intent)
// ════════════════════════════════════════
// Direct top-up is disabled. All top-ups must go through Stripe payment flow.
router.post('/top-up', topUpLimiter, protect, async (req, res) => {
  return res.status(410).json({
    success: false,
    message:
      'Direct top-up is no longer available. Please use the payment flow via /api/payments/create-intent.',
  });
});

// ════════════════════════════════════════
// POST /api/wallet/spend — Deduct Pet Dollars + credit seller (93%) + platform commission (7%)
// ════════════════════════════════════════
// Used for service payments (vet appointments, grooming, etc.)
// For shop checkout, the cart.js route handles this directly.
router.post('/spend', spendLimiter, protect, async (req, res) => {
  try {
    const { amount, description, reference, sellerId } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amount',
      });
    }
    if (parsedAmount > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Amount exceeds maximum limit',
      });
    }

    const spendAmount = Math.round(parsedAmount * 100) / 100;

    // Sanitize reference — only allow known fields (prevent injection of arbitrary objects)
    const safeReference = {
      entityType:
        typeof reference?.entityType === 'string' ? reference.entityType : null,
      entityId: reference?.entityId || null,
      shopId: reference?.shopId || null,
    };

    // Check balance first
    const user = await User.findById(req.user.id).select('petDollars');
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    if (user.petDollars < spendAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient Pet Dollars. You have P$${user.petDollars.toFixed(2)} but need P$${spendAmount.toFixed(2)}`,
        balance: user.petDollars,
      });
    }

    // Atomic decrement
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user.id, petDollars: { $gte: spendAmount } },
      { $inc: { petDollars: -spendAmount } },
      { new: true, select: 'petDollars' },
    );

    if (!updatedUser) {
      return res.status(400).json({
        success: false,
        message:
          'Insufficient balance or concurrent transaction. Please try again.',
      });
    }

    // ── Commission split: 93% to seller, 7% to platform ──
    const split = calculateCommission(spendAmount);
    let sellerCredited = false;

    if (sellerId) {
      // Validate seller exists
      const seller = await User.findById(sellerId).select('petDollars name');
      if (seller) {
        // Atomically credit the seller's wallet (93%)
        const updatedSeller = await User.findByIdAndUpdate(
          sellerId,
          { $inc: { petDollars: split.sellerAmount } },
          { new: true, select: 'petDollars' },
        );

        if (updatedSeller) {
          sellerCredited = true;

          // Record seller's incoming transaction
          await WalletTransaction.create({
            user: sellerId,
            type: 'transfer_in',
            amount: split.sellerAmount,
            balanceAfter: updatedSeller.petDollars,
            description: `Service payment received — P$${spendAmount.toFixed(2)} (${(split.commissionRate * 100).toFixed(0)}% platform fee deducted)`,
            reference: safeReference,
            commission: {
              rate: split.commissionRate,
              platformAmount: split.platformAmount,
              sellerAmount: split.sellerAmount,
              sellerId: sellerId,
            },
            status: 'completed',
          });

          // Notify seller of incoming payment
          try {
            await notify(
              sellerId,
              'payment_received',
              'Payment Received 💰',
              `You received P$${split.sellerAmount.toFixed(2)} for a service payment.`,
              { earned: split.sellerAmount },
            );
          } catch (notifErr) {
            console.error('Seller notification error:', notifErr.message);
          }
        }
      }
    }

    // Record buyer's transaction
    const transaction = await WalletTransaction.create({
      user: req.user.id,
      type: 'purchase',
      amount: -spendAmount,
      balanceAfter: updatedUser.petDollars,
      description:
        typeof description === 'string'
          ? description.slice(0, 200)
          : `Spent P$${spendAmount.toFixed(2)}`,
      reference: safeReference,
      commission: sellerId
        ? {
            rate: split.commissionRate,
            platformAmount: split.platformAmount,
            sellerAmount: split.sellerAmount,
            sellerId: sellerId,
          }
        : undefined,
      status: 'completed',
    });

    res.json({
      success: true,
      message: `P$${spendAmount.toFixed(2)} deducted from your wallet`,
      balance: updatedUser.petDollars,
      transaction,
      sellerCredited,
    });
  } catch (error) {
    console.error('Wallet spend error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
