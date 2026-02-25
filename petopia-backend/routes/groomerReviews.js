const express = require('express');
const GroomerReview = require('../models/GroomerReview');
const GroomerShop = require('../models/GroomerShop');
const GroomerAppointment = require('../models/GroomerAppointment');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/groomer-reviews/:shopId â€” Get all reviews for a groomer shop
router.get('/:shopId', async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'newest' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let sortOption;
    switch (sort) {
      case 'highest':
        sortOption = { rating: -1, createdAt: -1 };
        break;
      case 'lowest':
        sortOption = { rating: 1, createdAt: -1 };
        break;
      case 'helpful':
        sortOption = { helpfulCount: -1, createdAt: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const total = await GroomerReview.countDocuments({
      shop: req.params.shopId,
    });
    const reviews = await GroomerReview.find({ shop: req.params.shopId })
      .populate('user', 'name profileImage')
      .populate('pet', 'name species')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Rating distribution
    const distribution = await GroomerReview.aggregate([
      {
        $match: {
          shop: require('mongoose').Types.ObjectId.createFromHexString(
            req.params.shopId,
          ),
        },
      },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach((d) => {
      ratingDistribution[d._id] = d.count;
    });

    res.json({
      success: true,
      reviews,
      ratingDistribution,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get groomer reviews error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/groomer-reviews/:shopId/can-review â€” Check if user can leave a review
router.get('/:shopId/can-review', protect, async (req, res) => {
  try {
    const existing = await GroomerReview.findOne({
      shop: req.params.shopId,
      user: req.user.id,
    });
    const completedAppt = await GroomerAppointment.findOne({
      shop: req.params.shopId,
      user: req.user.id,
      status: 'completed',
    });
    const shop = await GroomerShop.findById(req.params.shopId);
    const isOwner = shop && shop.owner.toString() === req.user.id;
    res.json({
      success: true,
      canReview: !existing && !!completedAppt && !isOwner,
      hasReviewed: !!existing,
      hasCompletedService: !!completedAppt,
      isOwner: !!isOwner,
    });
  } catch (error) {
    console.error('Can review check error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groomer-reviews/:shopId â€” Create a review
router.post('/:shopId', protect, async (req, res) => {
  try {
    const shop = await GroomerShop.findById(req.params.shopId);
    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: 'Groomer shop not found' });
    }

    if (shop.owner.toString() === req.user.id) {
      return res
        .status(400)
        .json({ success: false, message: 'Cannot review your own shop' });
    }

    // Must have a completed appointment
    const completedAppointment = await GroomerAppointment.findOne({
      shop: req.params.shopId,
      user: req.user.id,
      status: 'completed',
    });
    if (!completedAppointment) {
      return res.status(400).json({
        success: false,
        message: 'You can only leave a review after a completed service',
      });
    }

    const existing = await GroomerReview.findOne({
      shop: req.params.shopId,
      user: req.user.id,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this shop',
      });
    }

    const { rating, title, comment, photos, pet, visitedFor } = req.body;

    if (!rating || !comment) {
      return res
        .status(400)
        .json({ success: false, message: 'Rating and comment are required' });
    }

    const review = await GroomerReview.create({
      shop: req.params.shopId,
      user: req.user.id,
      rating,
      title: title || '',
      comment,
      photos: photos || [],
      pet: pet || null,
      visitedFor: visitedFor || '',
    });

    const populated = await GroomerReview.findById(review._id)
      .populate('user', 'name profileImage')
      .populate('pet', 'name species');

    res.status(201).json({ success: true, review: populated });
  } catch (error) {
    console.error('Create groomer review error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this shop',
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/groomer-reviews/:reviewId â€” Update own review
router.put('/:reviewId', protect, async (req, res) => {
  try {
    const review = await GroomerReview.findById(req.params.reviewId);

    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: 'Review not found' });
    }

    if (review.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const { rating, title, comment, photos } = req.body;
    if (rating) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment) review.comment = comment;
    if (photos) review.photos = photos;

    await review.save();

    const populated = await GroomerReview.findById(review._id)
      .populate('user', 'name profileImage')
      .populate('pet', 'name species');

    res.json({ success: true, review: populated });
  } catch (error) {
    console.error('Update groomer review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/groomer-reviews/:reviewId â€” Delete own review
router.delete('/:reviewId', protect, async (req, res) => {
  try {
    const review = await GroomerReview.findById(req.params.reviewId);

    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: 'Review not found' });
    }

    if (review.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    await GroomerReview.findByIdAndDelete(req.params.reviewId);

    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    console.error('Delete groomer review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groomer-reviews/:reviewId/helpful â€” Toggle helpful vote
router.post('/:reviewId/helpful', protect, async (req, res) => {
  try {
    const review = await GroomerReview.findById(req.params.reviewId);

    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: 'Review not found' });
    }

    const idx = review.helpfulVotes.indexOf(req.user.id);
    if (idx > -1) {
      review.helpfulVotes.splice(idx, 1);
    } else {
      review.helpfulVotes.push(req.user.id);
    }
    review.helpfulCount = review.helpfulVotes.length;
    await review.save();

    res.json({
      success: true,
      helpfulCount: review.helpfulCount,
      isHelpful: idx === -1,
    });
  } catch (error) {
    console.error('Helpful vote error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groomer-reviews/:reviewId/respond â€” Groomer responds to a review
router.post('/:reviewId/respond', protect, async (req, res) => {
  try {
    const review = await GroomerReview.findById(req.params.reviewId).populate(
      'shop',
    );

    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: 'Review not found' });
    }

    if (review.shop.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the shop owner can respond to reviews',
      });
    }

    const { text } = req.body;
    if (!text) {
      return res
        .status(400)
        .json({ success: false, message: 'Response text is required' });
    }

    review.response = { text, respondedAt: new Date() };
    await review.save();

    const populated = await GroomerReview.findById(review._id)
      .populate('user', 'name profileImage')
      .populate('pet', 'name species');

    res.json({ success: true, review: populated });
  } catch (error) {
    console.error('Respond to groomer review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
