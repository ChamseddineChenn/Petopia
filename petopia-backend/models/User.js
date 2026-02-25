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
      minlength: 8,
      select: false, // Don't return password by default
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'vet', 'groomer', 'pet_sitter', 'pet_shop'],
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
    isPrivate: {
      type: Boolean,
      default: false,
    },
    showLocation: {
      type: Boolean,
      default: true,
    },
    showEmail: {
      type: Boolean,
      default: false,
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
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Push notification tokens (one per device)
    fcmTokens: [
      {
        token: { type: String, required: true },
        device: { type: String, default: 'unknown' },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    // Pet Dollar wallet balance
    petDollars: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Stripe customer ID — links to Stripe for payment processing
    stripeCustomerId: {
      type: String,
      default: null,
      select: false, // Don't include in normal queries
    },
    // Presence tracking
    lastSeen: {
      type: Date,
      default: null,
    },
    // --- Social post features ---
    interests: [{ type: String, trim: true, lowercase: true }], // e.g. ['dogs','cats','training']
    lastKnownLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// toJSON transform — strip sensitive fields from all JSON responses
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.verificationToken;
    delete ret.verificationTokenExpiry;
    delete ret.fcmTokens;
    delete ret.blockedUsers;
    delete ret.stripeCustomerId;
    delete ret.__v;
    return ret;
  },
});

userSchema.set('toObject', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.verificationToken;
    delete ret.verificationTokenExpiry;
    delete ret.fcmTokens;
    delete ret.blockedUsers;
    delete ret.stripeCustomerId;
    delete ret.__v;
    return ret;
  },
});

// Index for geo queries on user location
userSchema.index({ lastKnownLocation: '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(12);
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

  // Hash the code for secure storage using HMAC with server secret
  this.verificationToken = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(verificationCode)
    .digest('hex');

  // Set expiry to 15 minutes from now (limits brute-force window)
  this.verificationTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

  // Return the unhashed code to send to the user
  return verificationCode;
};

module.exports = mongoose.model('User', userSchema);
