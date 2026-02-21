const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendVerificationEmail } = require('../services/emailService');

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user and send verification email
// @access  Public
router.post('/register', async (req, res) => {
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
    } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Validate role if provided
    const validRoles = ['user', 'vet', 'groomer', 'pet_sitter'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account type',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Create user with verification token
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      emailVerified: false,
      role: role || 'user',
      phone: phone || '',
      gender: gender || '',
      dateOfBirth: dateOfBirth || null,
      country: country || '',
      city: city || '',
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
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify user email with token
// @access  Public
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
    }

    // Hash the token to match the stored one
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

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
    const jwtToken = generateToken(user._id);

    // Remove sensitive fields from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;
    delete userResponse.verificationTokenExpiry;

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      token: jwtToken,
      user: userResponse,
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during email verification',
    });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Resend verification email
// @access  Public
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
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
      message: error.message || 'Server error',
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user (only if email is verified)
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Check for user (include password field)
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password',
    );
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
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
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;
    delete userResponse.verificationTokenExpiry;

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
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

module.exports = router;
