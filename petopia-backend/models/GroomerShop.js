const mongoose = require('mongoose');

const workingHoursSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ],
      required: true,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    openTime: {
      type: String,
      default: '09:00',
    },
    closeTime: {
      type: String,
      default: '17:00',
    },
    breakStart: {
      type: String,
      default: null,
    },
    breakEnd: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      default: null,
    },
    duration: {
      type: Number,
      default: 30,
    },
    category: {
      type: String,
      enum: [
        'bath',
        'haircut',
        'nail_trim',
        'ear_cleaning',
        'teeth_brushing',
        'flea_treatment',
        'deshedding',
        'styling',
        'spa',
        'puppy_grooming',
        'senior_grooming',
        'breed_specific',
        'other',
      ],
      default: 'bath',
    },
  },
  { _id: true },
);

const groomerShopSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shopName: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      maxlength: [100, 'Shop name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    // Contact Information
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
    },
    email: {
      type: String,
      lowercase: true,
      default: '',
    },
    website: {
      type: String,
      default: '',
    },
    // Address
    address: {
      street: { type: String, default: '' },
      city: { type: String, required: [true, 'City is required'] },
      state: { type: String, default: '' },
      country: { type: String, default: '' },
      zipCode: { type: String, default: '' },
    },
    // GeoJSON location for geo queries
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    // Shop Media
    logo: {
      type: String,
      default: null,
    },
    photos: [
      {
        url: { type: String, required: true },
        caption: { type: String, default: '' },
      },
    ],
    // Services & Specializations
    services: [serviceSchema],
    specializations: [
      {
        type: String,
        trim: true,
      },
    ],
    acceptedPetTypes: [
      {
        type: String,
        enum: [
          'dog',
          'cat',
          'bird',
          'fish',
          'rabbit',
          'hamster',
          'turtle',
          'reptile',
          'exotic',
          'other',
        ],
      },
    ],
    // Working Hours
    workingHours: [workingHoursSchema],
    // Appointment Settings
    appointmentDuration: {
      type: Number,
      default: 30,
    },
    maxDailyAppointments: {
      type: Number,
      default: 20,
    },
    // Capabilities (groomer-specific)
    mobileGrooming: {
      type: Boolean,
      default: false,
    },
    homeVisitAvailable: {
      type: Boolean,
      default: false,
    },
    pickupDropoff: {
      type: Boolean,
      default: false,
    },
    // Ratings (aggregated)
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    // Status
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Social
    allowMessages: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Geo index for location-based queries
groomerShopSchema.index({ location: '2dsphere' });
// Text index for search
groomerShopSchema.index({
  shopName: 'text',
  description: 'text',
  'address.city': 'text',
});
// Sort index for rating queries
groomerShopSchema.index({ averageRating: -1, totalReviews: -1 });

module.exports = mongoose.model('GroomerShop', groomerShopSchema);
