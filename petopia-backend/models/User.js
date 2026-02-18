const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false, // Don't return password by default
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'vet', 'pet_sitter'],
      default: 'user',
    },
    verificationToken: {
      type: String,
      default: null,
      select: false,
    },
    verificationTokenExpiry: {
      type: Date,
      default: null,
      select: false,
    },
    profileImage: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say', ''],
      default: '',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    location: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate 6-digit verification code
userSchema.methods.generateVerificationToken = function () {
  // Generate a cryptographically secure 6-digit code
  const verificationCode = crypto.randomInt(100000, 999999).toString();

  // Hash the code for secure storage
  this.verificationToken = crypto
    .createHash('sha256')
    .update(verificationCode)
    .digest('hex');

  // Set expiry to 24 hours from now
  this.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Return the unhashed code to send to the user
  return verificationCode;
};

module.exports = mongoose.model('User', userSchema);
