const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendVerificationEmail } = require('../services/emailService');
const { audit } = require('../services/auditService');

const router = express.Router();

// Rate limiters for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts, please try again later',
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts, please try again later',
  },
});

// Generate JWT Access Token — pinned to HS256, includes token version for revocation
const generateToken = (id, tokenVersion) => {
  return jwt.sign({ id, v: tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
    algorithm: 'HS256',
  });
};

// Generate JWT Refresh Token — longer-lived, typed so it can't be used as access token
const generateRefreshToken = (id, tokenVersion) => {
  return jwt.sign(
    { id, v: tokenVersion || 0, type: 'refresh' },
    process.env.JWT_SECRET,
    {
      expiresIn: '30d',
      algorithm: 'HS256',
    },
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user and send verification email
// @access  Public
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      confirmPassword,
      role,
      phone,
      gender,
      dateOfBirth,
      country,
      city,
      termsAccepted,
    } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // PIPEDA / Canadian compliance: must accept Terms + Privacy Policy
    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message:
          'You must accept the Terms of Service and Privacy Policy to create an account',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    // Password complexity check: must include uppercase, lowercase, digit
    if (
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Password must include uppercase, lowercase, and a number',
      });
    }

    // Validate and accept role from client (self-registration)
    const allowedRoles = ['user', 'vet', 'groomer', 'pet_shop'];
    const assignedRole = allowedRoles.includes(role) ? role : 'user';
    // Service-provider roles require admin verification before full access
    const roleVerified = assignedRole === 'user';

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Create user with verification token
    const now = new Date();
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      emailVerified: false,
      role: assignedRole,
      roleVerified,
      phone: phone || '',
      gender: gender || '',
      dateOfBirth: dateOfBirth || null,
      country: country || '',
      city: city || '',
      // PIPEDA compliance: record consent timestamps
      termsAcceptedAt: now,
      termsVersion: '1.0',
      privacyPolicyAcceptedAt: now,
      privacyPolicyVersion: '1.0',
    });

    // Generate verification token
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the registration, but log the error
      // The user can request a new verification email
    }

    // Remove sensitive fields from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;
    delete userResponse.verificationTokenExpiry;

    res.status(201).json({
      success: true,
      message:
        'Registration successful! Please check your email to verify your account.',
      user: userResponse,
    });

    // Audit log (non-blocking)
    audit(req, 'register', user._id, 'New user registered');
    audit(
      req,
      'terms_accepted',
      user._id,
      `Terms v1.0 accepted at registration`,
    );
    audit(
      req,
      'privacy_policy_accepted',
      user._id,
      `Privacy Policy v1.0 accepted at registration`,
    );
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify user email with token
// @access  Public
router.post('/verify-email', authLimiter, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
    }

    // Hash the token with HMAC to match the stored one
    const hashedToken = crypto
      .createHmac('sha256', process.env.JWT_SECRET)
      .update(token)
      .digest('hex');

    // Find user by verification token
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    // Mark email as verified
    user.emailVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiry = null;
    await user.save();

    // Generate JWT token for auto-login after verification
    const jwtToken = generateToken(user._id, user.tokenVersion);
    const refreshToken = generateRefreshToken(user._id, user.tokenVersion);

    // Remove sensitive fields from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;
    delete userResponse.verificationTokenExpiry;

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      token: jwtToken,
      refreshToken,
      user: userResponse,
    });

    // Audit log (non-blocking)
    audit(req, 'email_verified', user._id, 'Email verified successfully');
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification',
    });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Resend verification email
// @access  Public
router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Return generic message regardless of user existence to prevent enumeration
    if (!user || user.emailVerified) {
      return res.status(200).json({
        success: true,
        message:
          'If this email is registered and unverified, a verification email has been sent',
      });
    }

    // Generate new verification token
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user (only if email is verified)
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Check for user (include password + lockout fields)
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password +loginAttempts +lockUntil +tokenVersion',
    );
    if (!user) {
      audit(req, 'login_failed', null, 'User not found', {
        email: email.toLowerCase(),
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Account lockout check — 5 failed attempts → 30-minute lock
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      audit(
        req,
        'login_locked',
        user._id,
        `Account locked (${minutesLeft}m remaining)`,
      );
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
      });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in',
        emailVerificationRequired: true,
      });
    }

    // Check password
    const isPasswordMatch = await user.matchPassword(password);
    if (!isPasswordMatch) {
      // Increment failed attempts
      const attempts = (user.loginAttempts || 0) + 1;
      const update = { loginAttempts: attempts };
      if (attempts >= 5) {
        update.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min
        audit(
          req,
          'account_locked',
          user._id,
          `Account locked after ${attempts} failed attempts`,
        );
      }
      await User.updateOne({ _id: user._id }, update);

      audit(req, 'login_failed', user._id, 'Incorrect password');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Successful login — reset lockout counters
    if (user.loginAttempts > 0 || user.lockUntil) {
      await User.updateOne(
        { _id: user._id },
        { loginAttempts: 0, lockUntil: null },
      );
    }

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;
    delete userResponse.verificationTokenExpiry;

    // Generate access + refresh tokens (include tokenVersion for revocation)
    const token = generateToken(user._id, user.tokenVersion);
    const refreshToken = generateRefreshToken(user._id, user.tokenVersion);

    res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: userResponse,
    });

    // Audit log (non-blocking)
    audit(req, 'login_success', user._id, 'User logged in');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select(
        'name email role profileImage bio gender dateOfBirth location country city phone isPrivate showLocation showEmail followers following petDollars lastSeen interests emailVerified notificationPreferences termsAcceptedAt termsVersion privacyPolicyAcceptedAt privacyPolicyVersion createdAt',
      )
      .lean();
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// ========================================================================
//  POST  /api/auth/refresh   — Exchange a valid refresh token for new tokens
// ========================================================================
router.post('/refresh', authLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
      });
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Must be a refresh-type token
    if (decoded.type !== 'refresh') {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid token type' });
    }

    // Verify user exists and token version matches
    const user = await User.findById(decoded.id)
      .select('_id tokenVersion emailVerified')
      .lean();
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: 'User no longer exists' });
    }
    if (typeof decoded.v === 'number' && decoded.v !== user.tokenVersion) {
      return res
        .status(401)
        .json({ success: false, message: 'Token has been revoked' });
    }
    if (!user.emailVerified) {
      return res
        .status(403)
        .json({ success: false, message: 'Email verification required' });
    }

    // Issue new token pair
    const newToken = generateToken(user._id, user.tokenVersion);
    const newRefreshToken = generateRefreshToken(user._id, user.tokenVersion);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  POST  /api/auth/logout   — Revoke ALL tokens for the current user
// ========================================================================
router.post('/logout', protect, async (req, res) => {
  try {
    // Bump tokenVersion — instantly invalidates every access + refresh token
    await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });

    audit(req, 'logout', req.user.id, 'User logged out (all tokens revoked)');

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
