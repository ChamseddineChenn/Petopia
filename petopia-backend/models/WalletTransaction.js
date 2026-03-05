const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'top_up',
        'purchase',
        'refund',
        'reward',
        'transfer_in', // seller receives P$ from a sale
        'transfer_out',
        'commission', // platform commission deducted from a sale
        'reservation', // funds held pending appointment acceptance
        'withdrawal', // P$ withdrawn to bank account / debit card
      ],
    },
    amount: {
      type: Number,
      required: true, // positive = credit, negative = debit
      validate: {
        validator: function (v) {
          return Number.isFinite(v) && v !== 0 && Math.abs(v) <= 100000;
        },
        message: 'Amount must be a non-zero finite number within ±100,000',
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    // Reference data for linking transactions to actions
    reference: {
      // What entity this transaction relates to
      entityType: {
        type: String,
        enum: [
          'shop_order',
          'vet_appointment',
          'groomer_appointment',
          'pet_sitter',
          'top_up',
          'stripe_payment',
          'refund',
          'reward',
          'withdrawal',
          null,
        ],
        default: null,
      },
      entityId: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      // For shop purchases — which shop/products
      shopId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PetShop',
        default: null,
      },
      items: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
          title: String,
          quantity: Number,
          price: Number,
        },
      ],
    },
    // Stripe payment details — populated for stripe_payment transactions
    stripeDetails: {
      paymentIntentId: { type: String, default: null },
      chargeId: { type: String, default: null },
      // Payer info snapshot (denormalized so records persist even if user changes email)
      payerName: { type: String, default: null, trim: true },
      payerEmail: { type: String, default: null, trim: true },
      // Payment method info
      paymentMethodType: { type: String, default: null }, // 'card', 'us_bank_account', etc.
      cardBrand: { type: String, default: null }, // 'visa', 'mastercard', 'amex', etc.
      cardLast4: { type: String, default: null }, // '4242'
      cardExpMonth: { type: Number, default: null },
      cardExpYear: { type: Number, default: null },
      cardCountry: { type: String, default: null }, // 'US', 'GB', etc.
      cardFunding: { type: String, default: null }, // 'credit', 'debit', 'prepaid'
      // Financial amounts
      amountCharged: { type: Number, default: null }, // Amount in cents charged by Stripe
      currency: { type: String, default: null }, // 'usd'
      stripeFee: { type: Number, default: null }, // Stripe processing fee in cents (if available)
      // Receipt
      receiptUrl: { type: String, default: null }, // Stripe-hosted receipt URL
      receiptEmail: { type: String, default: null },
      // Risk & status
      riskLevel: { type: String, default: null }, // 'normal', 'elevated', 'highest'
      riskScore: { type: Number, default: null }, // 0-100
      stripeStatus: { type: String, default: null }, // 'succeeded', 'failed', etc.
      // Timestamps from Stripe
      stripePaidAt: { type: Date, default: null },
    },
    // Commission tracking — populated for purchase transactions with a 7% platform cut
    commission: {
      // Commission rate applied (e.g. 0.07 for 7%)
      rate: { type: Number, default: null },
      // Platform's P$ cut from this transaction
      platformAmount: { type: Number, default: null },
      // Seller's net P$ received after commission
      sellerAmount: { type: Number, default: null },
      // The seller (service provider / shop owner) who received the funds
      sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'failed', 'reversed'],
      default: 'completed',
    },
  },
  {
    timestamps: true,
  },
);

// Prevent modification of financial fields after creation
walletTransactionSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  if (
    update.amount !== undefined ||
    update.balanceAfter !== undefined ||
    update.user !== undefined
  ) {
    throw new Error(
      'Cannot modify amount, balanceAfter, or user on a transaction',
    );
  }
});

// Fast lookups: user's transactions sorted by newest
walletTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
