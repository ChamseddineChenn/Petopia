const mongoose = require('mongoose');

const petShopSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    shopName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    logo: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: '' },
      zipCode: { type: String, default: '' },
    },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    categories: [
      {
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
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    productsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

petShopSchema.index({ location: '2dsphere' });
petShopSchema.index({ shopName: 'text', description: 'text' });
petShopSchema.index({ isActive: 1 });
petShopSchema.index({ 'address.city': 1 });

module.exports = mongoose.model('PetShop', petShopSchema);
