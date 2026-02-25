const express = require('express');
const VetClinic = require('../models/VetClinic');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ========================================
// PUBLIC ROUTES
// ========================================

// GET /api/vets â€” List all clinics (sorted by rating or distance)
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = 'rating', // 'rating' | 'nearest' | 'newest'
      lat,
      lng,
      search,
      petType,
      service,
      emergency,
      maxDistance = 50000, // 50km default
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { isActive: true };

    // Filter by pet type
    if (typeof petType === 'string') {
      filter.acceptedPetTypes = petType;
    }

    // Filter by emergency
    if (emergency === 'true') {
      filter.emergencyAvailable = true;
    }

    // Filter by service category
    if (typeof service === 'string') {
      filter['services.category'] = service;
    }

    // Text search
    if (typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search };
    }

    let query;

    // Sort by nearest (requires lat/lng)
    if (sort === 'nearest' && lat && lng) {
      query = VetClinic.find({
        ...filter,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            $maxDistance: parseInt(maxDistance),
          },
        },
      });
    } else {
      query = VetClinic.find(filter);

      if (sort === 'rating') {
        query = query.sort({ averageRating: -1, totalReviews: -1 });
      } else if (sort === 'newest') {
        query = query.sort({ createdAt: -1 });
      } else {
        query = query.sort({ averageRating: -1 });
      }
    }

    const total = await VetClinic.countDocuments(filter);
    const clinics = await query
      .populate('owner', 'name profileImage')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      clinics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get clinics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/vets/my/clinic â€” Get current user's clinic
// (Must be before /:id to prevent "my" being treated as an id)
router.get('/my/clinic', protect, async (req, res) => {
  try {
    const clinic = await VetClinic.findOne({ owner: req.user.id }).populate(
      'owner',
      'name profileImage',
    );

    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: 'You have no clinic registered' });
    }

    res.json({ success: true, clinic });
  } catch (error) {
    console.error('Get my clinic error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/vets/:id â€” Get single clinic detail
router.get('/:id', async (req, res) => {
  try {
    const clinic = await VetClinic.findById(req.params.id)
      .populate('owner', 'name profileImage bio location')
      .lean();

    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: 'Clinic not found' });
    }

    res.json({ success: true, clinic });
  } catch (error) {
    console.error('Get clinic error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// PROTECTED ROUTES (require auth)
// ========================================

// POST /api/vets â€” Create a clinic (user becomes vet)
router.post('/', protect, async (req, res) => {
  try {
    const {
      clinicName,
      description,
      phone,
      email,
      website,
      address,
      location,
      services,
      specializations,
      acceptedPetTypes,
      workingHours,
      appointmentDuration,
      maxDailyAppointments,
      emergencyAvailable,
      homeVisitAvailable,
      onlineConsultation,
      licenseNumber,
      yearsOfExperience,
      allowMessages,
      photos,
    } = req.body;

    if (!clinicName || !phone || !address?.city) {
      return res.status(400).json({
        success: false,
        message: 'Clinic name, phone, and city are required',
      });
    }

    // Check if user already has a clinic
    const existing = await VetClinic.findOne({ owner: req.user.id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have a registered clinic',
      });
    }

    const clinic = await VetClinic.create({
      owner: req.user.id,
      clinicName,
      description,
      phone,
      email,
      website,
      address,
      location,
      services: services || [],
      specializations: specializations || [],
      acceptedPetTypes: acceptedPetTypes || [
        'dog',
        'cat',
        'bird',
        'rabbit',
        'hamster',
        'turtle',
      ],
      workingHours: workingHours || getDefaultWorkingHours(),
      appointmentDuration: appointmentDuration || 30,
      maxDailyAppointments: maxDailyAppointments || 20,
      emergencyAvailable: emergencyAvailable || false,
      homeVisitAvailable: homeVisitAvailable || false,
      onlineConsultation: onlineConsultation || false,
      licenseNumber: licenseNumber || '',
      yearsOfExperience: yearsOfExperience || 0,
      allowMessages: allowMessages !== false,
      photos: photos || [],
    });

    // Update user role to 'vet'
    await User.findByIdAndUpdate(req.user.id, { role: 'vet' });

    res.status(201).json({ success: true, clinic });
  } catch (error) {
    console.error('Create clinic error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/vets/:id â€” Update clinic
router.put('/:id', protect, async (req, res) => {
  try {
    const clinic = await VetClinic.findById(req.params.id);

    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: 'Clinic not found' });
    }

    if (clinic.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    // Fields that can be updated
    const allowedFields = [
      'clinicName',
      'description',
      'phone',
      'email',
      'website',
      'address',
      'location',
      'logo',
      'services',
      'specializations',
      'acceptedPetTypes',
      'workingHours',
      'appointmentDuration',
      'maxDailyAppointments',
      'emergencyAvailable',
      'homeVisitAvailable',
      'onlineConsultation',
      'licenseNumber',
      'yearsOfExperience',
      'allowMessages',
      'isActive',
      'photos',
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updated = await VetClinic.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('owner', 'name profileImage');

    res.json({ success: true, clinic: updated });
  } catch (error) {
    console.error('Update clinic error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/vets/:id/photos â€” Add photos to clinic
router.post('/:id/photos', protect, async (req, res) => {
  try {
    const clinic = await VetClinic.findById(req.params.id);

    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: 'Clinic not found' });
    }

    if (clinic.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const { photos } = req.body; // array of { url, caption }
    if (!photos || !Array.isArray(photos)) {
      return res
        .status(400)
        .json({ success: false, message: 'Photos array is required' });
    }

    clinic.photos.push(...photos);
    await clinic.save();

    res.json({ success: true, photos: clinic.photos });
  } catch (error) {
    console.error('Add photos error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/vets/:id/photos/:photoId â€” Remove a photo
router.delete('/:id/photos/:photoId', protect, async (req, res) => {
  try {
    const clinic = await VetClinic.findById(req.params.id);

    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: 'Clinic not found' });
    }

    if (clinic.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    clinic.photos = clinic.photos.filter(
      (p) => p._id.toString() !== req.params.photoId,
    );
    await clinic.save();

    res.json({ success: true, photos: clinic.photos });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/vets/:id â€” Delete clinic
router.delete('/:id', protect, async (req, res) => {
  try {
    const clinic = await VetClinic.findById(req.params.id);

    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: 'Clinic not found' });
    }

    if (clinic.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    await VetClinic.findByIdAndDelete(req.params.id);

    // Revert user role back to 'user'
    await User.findByIdAndUpdate(req.user.id, { role: 'user' });

    res.json({ success: true, message: 'Clinic deleted' });
  } catch (error) {
    console.error('Delete clinic error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// Helper
// ========================================
function getDefaultWorkingHours() {
  const days = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  return days.map((day) => ({
    day,
    isOpen: day !== 'sunday',
    openTime: '09:00',
    closeTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
  }));
}

module.exports = router;
