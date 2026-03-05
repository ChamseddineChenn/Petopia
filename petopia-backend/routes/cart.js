const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const PetShop = require('../models/PetShop');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { deliverNotification } = require('../services/hybridDelivery');
const { calculateCommission } = require('../services/stripeService');

// Helper — send a notification + real-time push
async function notify(recipientId, senderId, type, title, body, data) {
  if (recipientId.toString() === senderId.toString()) return;
  const notif = await Notification.create({
    recipient: recipientId,
    sender: senderId,
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

// GET /api/cart — Get user's cart
router.get('/', protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'title price images isActive quantity',
      })
      .populate({
        path: 'items.shop',
        select: 'shopName logo',
      });

    if (!cart) {
      return res.json({ success: true, cart: { items: [], total: 0 } });
    }

    // Filter out items whose product was deleted or deactivated
    const validItems = cart.items.filter(
      (item) => item.product && item.product.isActive,
    );

    // Calculate total using CURRENT product price
    const total = validItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    res.json({
      success: true,
      cart: {
        _id: cart._id,
        items: validItems,
        total: Math.round(total * 100) / 100,
        itemCount: validItems.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/cart/add — Add item to cart
router.post('/add', protect, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res
        .status(404)
        .json({ success: false, message: 'Product not found or unavailable' });
    }

    if (product.quantity < quantity) {
      return res
        .status(400)
        .json({ success: false, message: 'Not enough stock' });
    }

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = await Cart.create({
        user: req.user.id,
        items: [
          {
            product: product._id,
            shop: product.shop,
            quantity,
            priceAtAdd: product.price,
          },
        ],
      });
    } else {
      const existingIdx = cart.items.findIndex(
        (item) => item.product.toString() === productId,
      );

      if (existingIdx >= 0) {
        // Update quantity
        const newQty = cart.items[existingIdx].quantity + quantity;
        if (newQty > product.quantity) {
          return res
            .status(400)
            .json({ success: false, message: 'Not enough stock' });
        }
        cart.items[existingIdx].quantity = newQty;
        cart.items[existingIdx].priceAtAdd = product.price;
      } else {
        // Add new item
        cart.items.push({
          product: product._id,
          shop: product.shop,
          quantity,
          priceAtAdd: product.price,
        });
      }

      await cart.save();
    }

    // Re-fetch populated cart
    cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'title price images isActive quantity',
      })
      .populate({
        path: 'items.shop',
        select: 'shopName logo',
      });

    const validItems = cart.items.filter(
      (item) => item.product && item.product.isActive,
    );
    const total = validItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    res.json({
      success: true,
      cart: {
        _id: cart._id,
        items: validItems,
        total: Math.round(total * 100) / 100,
        itemCount: validItems.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/cart/update — Update item quantity
router.put('/update', protect, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (quantity < 1) {
      return res
        .status(400)
        .json({ success: false, message: 'Quantity must be at least 1' });
    }

    const product = await Product.findById(productId);
    if (product && quantity > product.quantity) {
      return res
        .status(400)
        .json({ success: false, message: 'Not enough stock' });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: 'Cart not found' });
    }

    const idx = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );
    if (idx < 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Item not in cart' });
    }

    cart.items[idx].quantity = quantity;
    if (product) cart.items[idx].priceAtAdd = product.price;
    await cart.save();

    // Re-fetch populated
    const populated = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'title price images isActive quantity',
      })
      .populate({
        path: 'items.shop',
        select: 'shopName logo',
      });

    const validItems = populated.items.filter(
      (item) => item.product && item.product.isActive,
    );
    const total = validItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    res.json({
      success: true,
      cart: {
        _id: populated._id,
        items: validItems,
        total: Math.round(total * 100) / 100,
        itemCount: validItems.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/cart/remove/:productId — Remove item from cart
router.delete('/remove/:productId', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: 'Cart not found' });
    }

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== req.params.productId,
    );
    await cart.save();

    // Re-fetch populated
    const populated = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'title price images isActive quantity',
      })
      .populate({
        path: 'items.shop',
        select: 'shopName logo',
      });

    const validItems = (populated?.items || []).filter(
      (item) => item.product && item.product.isActive,
    );
    const total = validItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );

    res.json({
      success: true,
      cart: {
        _id: populated?._id,
        items: validItems,
        total: Math.round(total * 100) / 100,
        itemCount: validItems.reduce((sum, item) => sum + item.quantity, 0),
      },
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/cart/clear — Clear the cart
router.delete('/clear', protect, async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user.id }, { items: [] });
    res.json({
      success: true,
      cart: { items: [], total: 0, itemCount: 0 },
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/cart/checkout — Checkout: decrease stock, notify shops, clear cart
router.post('/checkout', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate({
      path: 'items.product',
      select: 'title price quantity isActive shop owner',
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Validate all items are still available
    const validItems = cart.items.filter(
      (item) => item.product && item.product.isActive,
    );
    if (validItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid items in cart',
      });
    }

    // Check stock for each item
    for (const item of validItems) {
      if (item.product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `"${item.product.title}" only has ${item.product.quantity} left in stock`,
        });
      }
    }

    // Calculate total first so we can check wallet balance
    let total = 0;
    for (const item of validItems) {
      total += item.product.price * item.quantity;
    }
    total = Math.round(total * 100) / 100;

    // Check Pet Dollar balance
    const buyer = await User.findById(req.user.id).select('petDollars');
    if (!buyer || buyer.petDollars < total) {
      return res.status(400).json({
        success: false,
        message: `Insufficient Pet Dollars. You have P$${(buyer?.petDollars || 0).toFixed(2)} but need P$${total.toFixed(2)}`,
        balance: buyer?.petDollars || 0,
      });
    }

    // Atomic deduct Pet Dollars (double-check with $gte to prevent race conditions)
    const updatedBuyer = await User.findOneAndUpdate(
      { _id: req.user.id, petDollars: { $gte: total } },
      { $inc: { petDollars: -total } },
      { new: true, select: 'petDollars' },
    );
    if (!updatedBuyer) {
      return res.status(400).json({
        success: false,
        message:
          'Insufficient balance or concurrent transaction. Please try again.',
      });
    }

    // Group items by shop owner for notifications
    const shopNotifications = {}; // ownerId -> [{ title, qty }]
    // Track per-owner totals for commission splitting
    const ownerTotals = {}; // ownerId -> total P$ for that owner's products

    // Decrease stock for each product
    for (const item of validItems) {
      // Atomic stock decrement — prevents overselling via race conditions
      const product = await Product.findOneAndUpdate(
        { _id: item.product._id, quantity: { $gte: item.quantity } },
        {
          $inc: { quantity: -item.quantity, soldCount: item.quantity },
        },
        { new: true },
      );
      if (!product) continue; // Skip if product gone or insufficient stock

      // Track per-owner revenue
      const ownerId = product.owner.toString();
      const itemTotal =
        Math.round(item.product.price * item.quantity * 100) / 100;
      ownerTotals[ownerId] = (ownerTotals[ownerId] || 0) + itemTotal;

      // Track for per-shop purchase notification
      if (!shopNotifications[ownerId]) shopNotifications[ownerId] = [];
      shopNotifications[ownerId].push({
        title: product.title,
        qty: item.quantity,
        productId: product._id.toString(),
      });

      // Low-stock alert: notify shop owner when quantity reaches <= 2
      if (product.quantity <= 2 && product.quantity >= 0) {
        await notify(
          product.owner,
          req.user.id,
          'low_stock_alert',
          'Low Stock Alert ⚠️',
          `"${product.title}" ${product.quantity === 0 ? 'is now out of stock!' : `only has ${product.quantity} left in stock.`}`,
          {
            type: 'low_stock',
            productId: product._id.toString(),
          },
        );
      }
    }

    // ── Credit each seller (93%) and record platform commission (7%) ──
    let totalPlatformCommission = 0;
    for (const [ownerId, ownerTotal] of Object.entries(ownerTotals)) {
      const split = calculateCommission(ownerTotal);
      totalPlatformCommission += split.platformAmount;

      // Atomically credit the seller's wallet
      const updatedSeller = await User.findByIdAndUpdate(
        ownerId,
        { $inc: { petDollars: split.sellerAmount } },
        { new: true, select: 'petDollars' },
      );

      if (updatedSeller) {
        // Record seller's incoming transaction (transfer_in)
        await WalletTransaction.create({
          user: ownerId,
          type: 'transfer_in',
          amount: split.sellerAmount,
          balanceAfter: updatedSeller.petDollars,
          description: `Sale revenue — P$${ownerTotal.toFixed(2)} purchase (${(split.commissionRate * 100).toFixed(0)}% platform fee deducted)`,
          reference: {
            entityType: 'shop_order',
            entityId: null,
          },
          commission: {
            rate: split.commissionRate,
            platformAmount: split.platformAmount,
            sellerAmount: split.sellerAmount,
            sellerId: ownerId,
          },
          status: 'completed',
        });
      }
    }

    // Send purchase notification to each shop owner
    for (const [ownerId, items] of Object.entries(shopNotifications)) {
      const ownerSplit = calculateCommission(ownerTotals[ownerId] || 0);
      const summary =
        items.length === 1
          ? `${items[0].qty}x "${items[0].title}"`
          : `${items.length} product(s)`;
      await notify(
        ownerId,
        req.user.id,
        'product_purchased',
        'New Purchase 🛒',
        `Someone purchased ${summary} from your shop! You earned P$${ownerSplit.sellerAmount.toFixed(2)}.`,
        {
          type: 'purchase',
          items,
          earned: ownerSplit.sellerAmount,
        },
      );
    }

    // Also update the PetShop productsCount if any product went to 0
    // (optional — keeps counts accurate)

    // Record buyer's wallet transaction
    const allItems = validItems.map((i) => ({
      productId: i.product._id,
      title: i.product.title,
      quantity: i.quantity,
      price: i.product.price,
    }));
    await WalletTransaction.create({
      user: req.user.id,
      type: 'purchase',
      amount: -total,
      balanceAfter: updatedBuyer.petDollars,
      description: `Pet Shop purchase — ${validItems.length} item(s) for P$${total.toFixed(2)}`,
      reference: {
        entityType: 'shop_order',
        items: allItems,
      },
      commission: {
        rate: 0.07,
        platformAmount: totalPlatformCommission,
        sellerAmount: Math.round((total - totalPlatformCommission) * 100) / 100,
        sellerId: null, // multiple sellers possible
      },
      status: 'completed',
    });

    // Clear the cart
    cart.items = [];
    await cart.save();

    res.json({
      success: true,
      message: 'Order placed successfully',
      total,
      balance: updatedBuyer.petDollars,
      cart: { items: [], total: 0, itemCount: 0 },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
