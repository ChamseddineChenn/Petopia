const express = require('express');
const HealthRecord = require('../models/HealthRecord');
const Pet = require('../models/Pet');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/health-records/:petId
// @desc    Get all health records for a pet
router.get('/:petId', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    if (pet.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const { recordType, limit = 50, page = 1 } = req.query;

    const query = { pet: req.params.petId, owner: req.user.id };
    if (recordType) {
      query.recordType = recordType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const records = await HealthRecord.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await HealthRecord.countDocuments(query);

    res.json({
      success: true,
      records,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Get health records error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/health-records/:petId/:recordId
// @desc    Get a single health record
router.get('/:petId/:recordId', async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.recordId);
    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: 'Record not found' });
    }
    if (record.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, record });
  } catch (error) {
    console.error('Get health record error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/health-records/:petId
// @desc    Create a health record for a pet
router.post('/:petId', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    if (pet.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const record = await HealthRecord.create({
      ...req.body,
      pet: req.params.petId,
      owner: req.user.id,
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    console.error('Create health record error:', error);
    res
      .status(500)
      .json({ success: false, message: error.message || 'Server error' });
  }
});

// @route   PUT /api/health-records/:petId/:recordId
// @desc    Update a health record
router.put('/:petId/:recordId', async (req, res) => {
  try {
    let record = await HealthRecord.findById(req.params.recordId);
    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: 'Record not found' });
    }
    if (record.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    record = await HealthRecord.findByIdAndUpdate(
      req.params.recordId,
      req.body,
      { new: true, runValidators: true },
    );

    res.json({ success: true, record });
  } catch (error) {
    console.error('Update health record error:', error);
    res
      .status(500)
      .json({ success: false, message: error.message || 'Server error' });
  }
});

// @route   DELETE /api/health-records/:petId/:recordId
// @desc    Delete a health record
router.delete('/:petId/:recordId', async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.recordId);
    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: 'Record not found' });
    }
    if (record.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    await HealthRecord.findByIdAndDelete(req.params.recordId);
    res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    console.error('Delete health record error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/health-records/:petId/upcoming/reminders
// @desc    Get upcoming vaccination and follow-up reminders
router.get('/:petId/upcoming/reminders', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    if (pet.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    const upcomingVaccinations = await HealthRecord.find({
      pet: req.params.petId,
      recordType: 'vaccination',
      'vaccination.nextDueDate': { $gte: now, $lte: thirtyDaysFromNow },
    }).sort({ 'vaccination.nextDueDate': 1 });

    const upcomingFollowUps = await HealthRecord.find({
      pet: req.params.petId,
      followUpDate: { $gte: now, $lte: thirtyDaysFromNow },
    }).sort({ followUpDate: 1 });

    res.json({
      success: true,
      vaccinations: upcomingVaccinations,
      followUps: upcomingFollowUps,
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
