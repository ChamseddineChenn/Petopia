const express = require('express');
const Review = require('../models/Review');
const VetClinic = require('../models/VetClinic');
const Appointment = require('../models/Appointment');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/:clinicId â€” Get all reviews for a clinic
router.get('/:clinicId', async (req, res) => {
  try {
    const { page = 1, limit: rawLimit = 20, sort = 'newest' } = req.query;
    const limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

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
      .limit(limit);

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

    // Validate rating range
    const parsedRating = parseInt(rating);
    if (
      !Number.isInteger(parsedRating) ||
      parsedRating < 1 ||
      parsedRating > 5
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Rating must be an integer between 1 and 5',
        });
    }

    // Validate text lengths
    if (comment.length > 5000) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Review comment cannot exceed 5000 characters',
        });
    }
    if (title && title.length > 200) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Review title cannot exceed 200 characters',
        });
    }

    // Validate photos array
    let validatedPhotos = [];
    if (photos && Array.isArray(photos)) {
      validatedPhotos = photos
        .filter((p) => typeof p === 'string' && p.length <= 2000)
        .slice(0, 10);
    }

    const review = await Review.create({
      clinic: req.params.clinicId,
      user: req.user.id,
      rating: parsedRating,
      title: title ? title.slice(0, 200) : '',
      comment,
      photos: validatedPhotos,
      pet: pet || null,
      visitedFor:
        typeof visitedFor === 'string' ? visitedFor.slice(0, 200) : '',
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
    if (rating !== undefined) {
      const parsedR = parseInt(rating);
      if (!Number.isInteger(parsedR) || parsedR < 1 || parsedR > 5) {
        return res
          .status(400)
          .json({ success: false, message: 'Rating must be 1-5' });
      }
      review.rating = parsedR;
    }
    if (title !== undefined)
      review.title = typeof title === 'string' ? title.slice(0, 200) : '';
    if (comment) {
      if (comment.length > 5000) {
        return res
          .status(400)
          .json({
            success: false,
            message: 'Review comment cannot exceed 5000 characters',
          });
      }
      review.comment = comment;
    }
    if (photos) {
      review.photos = Array.isArray(photos)
        ? photos
            .filter((p) => typeof p === 'string' && p.length <= 2000)
            .slice(0, 10)
        : [];
    }

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
    if (text.length > 2000) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Response cannot exceed 2000 characters',
        });
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
