const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PetShop',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: '',
      maxlength: 3000,
    },
    category: {
      type: String,
      enum: [
        'food',
        'treats',
        'toys',
        'accessories',
        'grooming',
        'health',
        'clothing',
        'crates_carriers',
        'aquarium',
        'other',
      ],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    images: [
      {
        type: String,
      },
    ],
    attributes: {
      weight: { type: String, default: '' },
      size: { type: String, default: '' },
      color: { type: String, default: '' },
      brand: { type: String, default: '' },
      material: { type: String, default: '' },
    },
    petType: {
      type: String,
      enum: [
        'dog',
        'cat',
        'bird',
        'fish',
        'small_animal',
        'reptile',
        'all',
        '',
      ],
      default: 'all',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    soldCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

productSchema.index({ shop: 1, isActive: 1 });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ owner: 1 });
productSchema.index({ petType: 1 });

module.exports = mongoose.model('Product', productSchema);
