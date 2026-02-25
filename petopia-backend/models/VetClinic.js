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
      type: String, // e.g. "09:00"
      default: '09:00',
    },
    closeTime: {
      type: String, // e.g. "17:00"
      default: '17:00',
    },
    breakStart: {
      type: String, // e.g. "12:00"
      default: null,
    },
    breakEnd: {
      type: String, // e.g. "13:00"
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
      required: [true, 'Service price is required'],
      min: [0, 'Price cannot be negative'],
    },
    duration: {
      type: Number, // duration in minutes
      default: 30,
    },
    category: {
      type: String,
      enum: [
        'consultation',
        'vaccination',
        'surgery',
        'dental',
        'grooming',
        'laboratory',
        'imaging',
        'emergency',
        'wellness',
        'deworming',
        'nutrition',
        'behavioral',
        'other',
      ],
      default: 'consultation',
    },
  },
  { _id: true },
);

const vetClinicSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clinicName: {
      type: String,
      required: [true, 'Clinic name is required'],
      trim: true,
      maxlength: [100, 'Clinic name cannot exceed 100 characters'],
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
    // GeoJSON location for geo queries (nearest vet)
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    // Clinic Media
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
      type: Number, // default slot duration in minutes
      default: 30,
    },
    maxDailyAppointments: {
      type: Number,
      default: 20,
    },
    // Capabilities
    emergencyAvailable: {
      type: Boolean,
      default: false,
    },
    homeVisitAvailable: {
      type: Boolean,
      default: false,
    },
    onlineConsultation: {
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
    // License / Credentials
    licenseNumber: {
      type: String,
      default: '',
    },
    yearsOfExperience: {
      type: Number,
      default: 0,
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
vetClinicSchema.index({ location: '2dsphere' });
// Text index for search
vetClinicSchema.index({
  clinicName: 'text',
  description: 'text',
  'address.city': 'text',
});
// Sort index for rating queries
vetClinicSchema.index({ averageRating: -1, totalReviews: -1 });

module.exports = mongoose.model('VetClinic', vetClinicSchema);
