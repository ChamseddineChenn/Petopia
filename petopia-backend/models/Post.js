const mongoose = require('mongoose');

// ========================================
// Media sub-schema (images, videos, carousels)
// ========================================
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true }, // Cloudinary secure_url
    publicId: { type: String, required: true }, // Cloudinary public_id (for deletion)
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true,
    },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null }, // seconds, video only
    thumbnail: { type: String, default: null }, // video poster frame URL
  },
  { _id: false },
);

// ========================================
// Post schema
// ========================================
const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      default: null,
    },

    // --- Content ---
    content: {
      type: String,
      default: '',
      maxlength: [2000, 'Post cannot exceed 2000 characters'],
    },
    media: [mediaSchema], // carousel = multiple items

    // --- Categorisation ---
    tags: [{ type: String, trim: true, lowercase: true }], // e.g. ['dogs','training','funny']

    // --- Location (GeoJSON Point) ---
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
      name: { type: String }, // human-readable place name (no default — avoids empty subdoc)
    },

    // --- Atomic counters (updated via $inc — never computed from arrays) ---
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },

    // --- Like tracking (for toggle + "has user liked?") ---
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // --- Share / Quoted post ---
    sharedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },

    // soft-delete
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ========================================
// Indexes
// ========================================
postSchema.index({ location: '2dsphere' }); // $geoNear queries
postSchema.index({ tags: 1 }); // tag-based filtering
postSchema.index({ createdAt: -1 }); // chronological feed
postSchema.index({ author: 1, createdAt: -1 }); // user profile posts

// Strip empty / incomplete location so the 2dsphere index doesn't choke
postSchema.pre('validate', function () {
  if (
    this.location &&
    (!this.location.type ||
      !this.location.coordinates ||
      this.location.coordinates.length !== 2)
  ) {
    this.location = undefined;
  }
});

// Exclude soft-deleted posts by default on all find queries
postSchema.pre(/^find/, function () {
  if (this.getFilter().deleted === undefined) {
    this.where({ deleted: { $ne: true } });
  }
});

postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);
