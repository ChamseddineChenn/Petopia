const express = require('express');
const Review = require('../models/Review');
const VetClinic = require('../models/VetClinic');
const Appointment = require('../models/Appointment');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/:clinicId â€” Get all reviews for a clinic
router.get('/:clinicId', async (req, res) => {
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

    const total = await Review.countDocuments({ clinic: req.params.clinicId });
    const reviews = await Review.find({ clinic: req.params.clinicId })
      .populate('user', 'name profileImage')
      .populate('pet', 'name species')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Rating distribution
    const distribution = await Review.aggregate([
      {
        $match: {
          clinic: require('mongoose').Types.ObjectId.createFromHexString(
            req.params.clinicId,
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
    console.error('Get reviews error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/reviews/:clinicId/can-review â€” Check if user can leave a review
router.get('/:clinicId/can-review', protect, async (req, res) => {
  try {
    const existing = await Review.findOne({
      clinic: req.params.clinicId,
      user: req.user.id,
    });
    const completedAppt = await Appointment.findOne({
      clinic: req.params.clinicId,
      user: req.user.id,
      status: 'completed',
    });
    const clinic = await VetClinic.findById(req.params.clinicId);
    const isOwner = clinic && clinic.owner.toString() === req.user.id;
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

// POST /api/reviews/:clinicId â€” Create a review
router.post('/:clinicId', protect, async (req, res) => {
  try {
    const clinic = await VetClinic.findById(req.params.clinicId);
    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: 'Clinic not found' });
    }

    // Can't review own clinic
    if (clinic.owner.toString() === req.user.id) {
      return res
        .status(400)
        .json({ success: false, message: 'Cannot review your own clinic' });
    }

    // Must have a completed appointment
    const completedAppointment = await Appointment.findOne({
      clinic: req.params.clinicId,
      user: req.user.id,
      status: 'completed',
    });
    if (!completedAppointment) {
      return res.status(400).json({
        success: false,
        message: 'You can only leave a review after a completed appointment',
      });
    }

    // Check if already reviewed
    const existing = await Review.findOne({
      clinic: req.params.clinicId,
      user: req.user.id,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this clinic',
      });
    }

    const { rating, title, comment, photos, pet, visitedFor } = req.body;

    if (!rating || !comment) {
      return res
        .status(400)
        .json({ success: false, message: 'Rating and comment are required' });
    }

    const review = await Review.create({
      clinic: req.params.clinicId,
      user: req.user.id,
      rating,
      title: title || '',
      comment,
      photos: photos || [],
      pet: pet || null,
      visitedFor: visitedFor || '',
    });

    const populated = await Review.findById(review._id)
      .populate('user', 'name profileImage')
      .populate('pet', 'name species');

    res.status(201).json({ success: true, review: populated });
  } catch (error) {
    console.error('Create review error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this clinic',
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/reviews/:reviewId â€” Update own review
router.put('/:reviewId', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);

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

    const populated = await Review.findById(review._id)
      .populate('user', 'name profileImage')
      .populate('pet', 'name species');

    res.json({ success: true, review: populated });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/reviews/:reviewId â€” Delete own review
router.delete('/:reviewId', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);

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

    await Review.findByIdAndDelete(req.params.reviewId);

    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/reviews/:reviewId/helpful â€” Toggle helpful vote
router.post('/:reviewId/helpful', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);

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

// POST /api/reviews/:reviewId/respond â€” Vet responds to a review
router.post('/:reviewId/respond', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId).populate(
      'clinic',
    );

    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: 'Review not found' });
    }

    // Only clinic owner can respond
    if (review.clinic.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the clinic owner can respond to reviews',
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

    const populated = await Review.findById(review._id)
      .populate('user', 'name profileImage')
      .populate('pet', 'name species');

    res.json({ success: true, review: populated });
  } catch (error) {
    console.error('Respond to review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
