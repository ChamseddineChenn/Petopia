const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    clinic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VetClinic',
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
    // Optional photos to accompany the review
    photos: [
      {
        type: String,
      },
    ],
    // Vet's response to the review
    response: {
      text: { type: String, default: null },
      respondedAt: { type: Date, default: null },
    },
    // Which pet was treated (optional context)
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

// A user can only leave one review per clinic
reviewSchema.index({ clinic: 1, user: 1 }, { unique: true });
// Sort by most recent
reviewSchema.index({ clinic: 1, createdAt: -1 });

// After save/remove: recalculate clinic's average rating
reviewSchema.statics.calcAverageRating = async function (clinicId) {
  const stats = await this.aggregate([
    { $match: { clinic: clinicId } },
    {
      $group: {
        _id: '$clinic',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const VetClinic = mongoose.model('VetClinic');
  if (stats.length > 0) {
    await VetClinic.findByIdAndUpdate(clinicId, {
      averageRating: Math.round(stats[0].avgRating * 10) / 10,
      totalReviews: stats[0].count,
    });
  } else {
    await VetClinic.findByIdAndUpdate(clinicId, {
      averageRating: 0,
      totalReviews: 0,
    });
  }
};

reviewSchema.post('save', async function () {
  await this.constructor.calcAverageRating(this.clinic);
});

reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await doc.constructor.calcAverageRating(doc.clinic);
  }
});

module.exports = mongoose.model('Review', reviewSchema);
