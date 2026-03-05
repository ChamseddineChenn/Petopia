const express = require('express');
const HealthRecord = require('../models/HealthRecord');
const Pet = require('../models/Pet');
const Appointment = require('../models/Appointment');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Whitelist of allowed fields for health record create/update
const ALLOWED_HEALTH_RECORD_FIELDS = [
  'recordType',
  'title',
  'description',
  'date',
  'veterinarian',
  'vaccination',
  'examination',
  'laboratory',
  'prescription',
  'surgery',
  'attachments',
  'notes',
  'followUpDate',
  'followUpNotes',
  'cost',
];

function pickFields(body, allowed) {
  const result = {};
  for (const key of allowed) {
    if (body[key] !== undefined) result[key] = body[key];
  }
  return result;
}

/**
 * Check if user is the pet owner OR a vet who has an appointment with the pet.
 * Returns { authorized: true, isOwner: bool, isVet: bool } or { authorized: false }.
 */
async function authorizeForPet(userId, pet) {
  if (pet.owner.toString() === userId) {
    return { authorized: true, isOwner: true, isVet: false };
  }

  // Check if user is a vet with a confirmed/completed appointment for this pet
  const appointment = await Appointment.findOne({
    vet: userId,
    pet: pet._id,
    status: { $in: ['confirmed', 'completed'] },
  });

  if (appointment) {
    return { authorized: true, isOwner: false, isVet: true };
  }

  return { authorized: false, isOwner: false, isVet: false };
}

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

    const auth = await authorizeForPet(req.user.id, pet);
    if (!auth.authorized) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const { recordType, limit = 50, page = 1 } = req.query;

    // Both owner and vet see all records for this pet
    const query = { pet: req.params.petId };
    if (typeof recordType === 'string') {
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
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    const auth = await authorizeForPet(req.user.id, pet);
    if (!auth.authorized) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const record = await HealthRecord.findById(req.params.recordId);
    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: 'Record not found' });
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

    const auth = await authorizeForPet(req.user.id, pet);
    if (!auth.authorized) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    // owner is always the pet's actual owner, so the record stays with the pet
    const record = await HealthRecord.create({
      ...pickFields(req.body, ALLOWED_HEALTH_RECORD_FIELDS),
      pet: req.params.petId,
      owner: pet.owner,
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, record });
  } catch (error) {
    console.error('Create health record error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/health-records/:petId/:recordId
// @desc    Update a health record
router.put('/:petId/:recordId', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    const auth = await authorizeForPet(req.user.id, pet);
    if (!auth.authorized) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    let record = await HealthRecord.findById(req.params.recordId);
    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: 'Record not found' });
    }

    record = await HealthRecord.findByIdAndUpdate(
      req.params.recordId,
      pickFields(req.body, ALLOWED_HEALTH_RECORD_FIELDS),
      { new: true, runValidators: true },
    );

    res.json({ success: true, record });
  } catch (error) {
    console.error('Update health record error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/health-records/:petId/:recordId
// @desc    Delete a health record
router.delete('/:petId/:recordId', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.petId);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    const auth = await authorizeForPet(req.user.id, pet);
    if (!auth.authorized) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const record = await HealthRecord.findById(req.params.recordId);
    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: 'Record not found' });
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

    const auth = await authorizeForPet(req.user.id, pet);
    if (!auth.authorized) {
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
