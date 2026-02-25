const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PetShop',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 999,
      default: 1,
    },
    priceAtAdd: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true },
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: {
      type: [cartItemSchema],
      validate: {
        validator: function (v) {
          return v.length <= 50;
        },
        message: 'Cart cannot contain more than 50 items',
      },
    },
  },
  { timestamps: true },
);

cartSchema.index({ user: 1 });

module.exports = mongoose.model('Cart', cartSchema);
