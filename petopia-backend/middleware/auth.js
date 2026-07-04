const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    // Pin algorithm to HS256 to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // Reject refresh tokens used as access tokens
    if (decoded.type === 'refresh') {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid token type' });
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.id)
      .select('_id role emailVerified tokenVersion roleVerified')
      .lean();
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: 'User no longer exists' });
    }

    // Check token version — reject revoked tokens
    // Treat missing tokenVersion (pre-existing users) as 0 (the schema default)
    const dbTokenVersion = user.tokenVersion ?? 0;
    if (typeof decoded.v === 'number' && decoded.v !== dbTokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please log in again.',
      });
    }

    // Enforce email verification
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required',
        emailVerificationRequired: true,
      });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      roleVerified: user.roleVerified ?? true, // Pre-existing users default to verified
    };
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: 'Not authorized to access this route' });
  }
};

/**
 * Role-Based Access Control middleware.
 * Usage: router.post('/admin-only', protect, restrictTo('admin'), handler)
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  };
};

/**
 * Require that a service-provider role has been admin-verified.
 * For regular users this is a no-op.
 * Usage: router.post('/create-clinic', protect, restrictTo('vet'), requireVerifiedRole, handler)
 */
exports.requireVerifiedRole = (req, res, next) => {
  if (req.user.role !== 'user' && !req.user.roleVerified) {
    return res.status(403).json({
      success: false,
      message:
        'Your professional role has not been verified yet. Please contact support.',
    });
  }
  next();
};
