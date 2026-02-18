const mongoose = require('mongoose');

const petSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide a pet name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    species: {
      type: String,
      required: [true, 'Please provide the species'],
      enum: [
        'dog',
        'cat',
        'bird',
        'fish',
        'rabbit',
        'hamster',
        'turtle',
        'other',
      ],
    },
    breed: {
      type: String,
      trim: true,
      default: '',
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'unknown'],
      default: 'unknown',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    weight: {
      type: Number,
      default: null,
    },
    color: {
      type: String,
      trim: true,
      default: '',
    },
    profileImage: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: '',
      maxlength: [300, 'Bio cannot be more than 300 characters'],
    },
    isNeutered: {
      type: Boolean,
      default: false,
    },
    vaccinations: [
      {
        name: String,
        date: Date,
        nextDue: Date,
      },
    ],
    medicalNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

// Virtual for age calculation
petSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const now = new Date();
  const birth = new Date(this.dateOfBirth);
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years--;
  }
  return years;
});

// Ensure virtuals are included in JSON
petSchema.set('toJSON', { virtuals: true });
petSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Pet', petSchema);
