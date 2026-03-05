const express = require('express');
const Pet = require('../models/Pet');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/pets
// @desc    Get all pets for the logged-in user
router.get('/', async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, pets, count: pets.length });
  } catch (error) {
    console.error('Get pets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/pets/:id
// @desc    Get a single pet by ID
router.get('/:id', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    if (pet.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }
    res.json({ success: true, pet });
  } catch (error) {
    console.error('Get pet error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/pets
// @desc    Add a new pet
router.post('/', async (req, res) => {
  try {
    const {
      name,
      species,
      breed,
      gender,
      dateOfBirth,
      weight,
      color,
      bio,
      isNeutered,
      profileImage,
    } = req.body;

    if (!name || !species) {
      return res
        .status(400)
        .json({ success: false, message: 'Name and species are required' });
    }

    // Input validation
    if (name.length > 100) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Pet name cannot exceed 100 characters',
        });
    }
    if (bio && bio.length > 500) {
      return res
        .status(400)
        .json({ success: false, message: 'Bio cannot exceed 500 characters' });
    }
    if (weight !== undefined && weight !== null) {
      const parsedWeight = parseFloat(weight);
      if (isNaN(parsedWeight) || parsedWeight < 0 || parsedWeight > 2000) {
        return res
          .status(400)
          .json({
            success: false,
            message: 'Weight must be between 0 and 2000',
          });
      }
    }
    if (
      profileImage &&
      typeof profileImage === 'string' &&
      profileImage.length > 2000
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Profile image URL too long' });
    }

    const pet = await Pet.create({
      owner: req.user.id,
      name,
      species,
      breed: breed || '',
      gender: gender || 'unknown',
      dateOfBirth: dateOfBirth || null,
      weight: weight || null,
      color: color || '',
      bio: bio || '',
      isNeutered: isNeutered || false,
      profileImage: profileImage || '',
    });

    res.status(201).json({ success: true, pet });
  } catch (error) {
    console.error('Create pet error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/pets/:id
// @desc    Update a pet
router.put('/:id', async (req, res) => {
  try {
    let pet = await Pet.findById(req.params.id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    if (pet.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    const allowedFields = [
      'name',
      'species',
      'breed',
      'gender',
      'dateOfBirth',
      'weight',
      'color',
      'profileImage',
      'bio',
      'isNeutered',
      'medicalNotes',
    ];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    pet = await Pet.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, pet });
  } catch (error) {
    console.error('Update pet error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/pets/:id
// @desc    Delete a pet
router.delete('/:id', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    if (pet.owner.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    await Pet.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Pet removed' });
  } catch (error) {
    console.error('Delete pet error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
