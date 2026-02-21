const mongoose = require('mongoose');

const groomerReviewSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroomerShop',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
      default: '',
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    photos: [
      {
        type: String,
      },
    ],
    // Groomer's response to the review
    response: {
      text: { type: String, default: null },
      respondedAt: { type: Date, default: null },
    },
    // Which pet was groomed (optional context)
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      default: null,
    },
    // Service context
    visitedFor: {
      type: String,
      default: '',
    },
    // Helpful votes
    helpfulVotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    helpfulCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// A user can only leave one review per shop
groomerReviewSchema.index({ shop: 1, user: 1 }, { unique: true });
// Sort by most recent
groomerReviewSchema.index({ shop: 1, createdAt: -1 });

// After save/remove: recalculate shop's average rating
groomerReviewSchema.statics.calcAverageRating = async function (shopId) {
  const stats = await this.aggregate([
    { $match: { shop: shopId } },
    {
      $group: {
        _id: '$shop',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const GroomerShop = mongoose.model('GroomerShop');
  if (stats.length > 0) {
    await GroomerShop.findByIdAndUpdate(shopId, {
      averageRating: Math.round(stats[0].avgRating * 10) / 10,
      totalReviews: stats[0].count,
    });
  } else {
    await GroomerShop.findByIdAndUpdate(shopId, {
      averageRating: 0,
      totalReviews: 0,
    });
  }
};

groomerReviewSchema.post('save', async function () {
  await this.constructor.calcAverageRating(this.shop);
});

groomerReviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await doc.constructor.calcAverageRating(doc.shop);
  }
});

module.exports = mongoose.model('GroomerReview', groomerReviewSchema);
