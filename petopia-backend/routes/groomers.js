const express = require('express');
const GroomerShop = require('../models/GroomerShop');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ========================================
// PUBLIC ROUTES
// ========================================

// GET /api/groomers â€” List all groomer shops
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = 'rating',
      lat,
      lng,
      search,
      petType,
      service,
      mobile,
      maxDistance = 50000,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { isActive: true };

    if (typeof petType === 'string') {
      filter.acceptedPetTypes = petType;
    }

    if (mobile === 'true') {
      filter.mobileGrooming = true;
    }

    if (typeof service === 'string') {
      filter['services.category'] = service;
    }

    if (typeof search === 'string' && search.trim()) {
      filter.$text = { $search: search };
    }

    let query;

    if (sort === 'nearest' && lat && lng) {
      query = GroomerShop.find({
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
      query = GroomerShop.find(filter);

      if (sort === 'rating') {
        query = query.sort({ averageRating: -1, totalReviews: -1 });
      } else if (sort === 'newest') {
        query = query.sort({ createdAt: -1 });
      } else {
        query = query.sort({ averageRating: -1 });
      }
    }

    const total = await GroomerShop.countDocuments(filter);
    const shops = await query
      .populate('owner', 'name profileImage')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      shops,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get groomer shops error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/groomers/my/shop â€” Get current user's groomer shop
router.get('/my/shop', protect, async (req, res) => {
  try {
    const shop = await GroomerShop.findOne({ owner: req.user.id }).populate(
      'owner',
      'name profileImage',
    );

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'You have no groomer shop registered',
      });
    }

    res.json({ success: true, shop });
  } catch (error) {
    console.error('Get my shop error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/groomers/:id â€” Get single shop detail
router.get('/:id', async (req, res) => {
  try {
    const shop = await GroomerShop.findById(req.params.id)
      .populate('owner', 'name profileImage bio location')
      .lean();

    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: 'Groomer shop not found' });
    }

    res.json({ success: true, shop });
  } catch (error) {
    console.error('Get shop error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// PROTECTED ROUTES
// ========================================

// POST /api/groomers â€” Create a groomer shop (user becomes groomer)
router.post('/', protect, async (req, res) => {
  try {
    const {
      shopName,
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
      mobileGrooming,
      homeVisitAvailable,
      pickupDropoff,
      allowMessages,
      photos,
    } = req.body;

    if (!shopName || !phone || !address?.city) {
      return res.status(400).json({
        success: false,
        message: 'Shop name, phone, and city are required',
      });
    }

    // Check if user already has a shop
    const existing = await GroomerShop.findOne({ owner: req.user.id });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have a registered groomer shop',
      });
    }

    const shop = await GroomerShop.create({
      owner: req.user.id,
      shopName,
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
      mobileGrooming: mobileGrooming || false,
      homeVisitAvailable: homeVisitAvailable || false,
      pickupDropoff: pickupDropoff || false,
      allowMessages: allowMessages !== false,
      photos: photos || [],
    });

    // Update user role to 'groomer'
    await User.findByIdAndUpdate(req.user.id, { role: 'groomer' });

    res.status(201).json({ success: true, shop });
  } catch (error) {
    console.error('Create groomer shop error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/groomers/:id â€” Update shop
router.put('/:id', protect, async (req, res) => {
  try {
    const shop = await GroomerShop.findById(req.params.id);

    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: 'Shop not found' });
    }

    if (shop.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const allowedFields = [
      'shopName',
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
      'mobileGrooming',
      'homeVisitAvailable',
      'pickupDropoff',
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

    const updated = await GroomerShop.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      },
    ).populate('owner', 'name profileImage');

    res.json({ success: true, shop: updated });
  } catch (error) {
    console.error('Update shop error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/groomers/:id/photos â€” Add photos
router.post('/:id/photos', protect, async (req, res) => {
  try {
    const shop = await GroomerShop.findById(req.params.id);

    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: 'Shop not found' });
    }

    if (shop.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const { photos } = req.body;
    if (!photos || !Array.isArray(photos)) {
      return res
        .status(400)
        .json({ success: false, message: 'Photos array is required' });
    }

    shop.photos.push(...photos);
    await shop.save();

    res.json({ success: true, photos: shop.photos });
  } catch (error) {
    console.error('Add photos error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/groomers/:id/photos/:photoId â€” Remove a photo
router.delete('/:id/photos/:photoId', protect, async (req, res) => {
  try {
    const shop = await GroomerShop.findById(req.params.id);

    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: 'Shop not found' });
    }

    if (shop.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    shop.photos = shop.photos.filter(
      (p) => p._id.toString() !== req.params.photoId,
    );
    await shop.save();

    res.json({ success: true, photos: shop.photos });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/groomers/:id â€” Delete shop
router.delete('/:id', protect, async (req, res) => {
  try {
    const shop = await GroomerShop.findById(req.params.id);

    if (!shop) {
      return res
        .status(404)
        .json({ success: false, message: 'Shop not found' });
    }

    if (shop.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    await GroomerShop.findByIdAndDelete(req.params.id);

    // Revert user role back to 'user'
    await User.findByIdAndUpdate(req.user.id, { role: 'user' });

    res.json({ success: true, message: 'Groomer shop deleted' });
  } catch (error) {
    console.error('Delete shop error:', error);
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
