const mongoose = require('mongoose');

const followRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

followRequestSchema.index({ from: 1, to: 1 }, { unique: true });
followRequestSchema.index({ to: 1, status: 1 });

module.exports = mongoose.model('FollowRequest', followRequestSchema);
