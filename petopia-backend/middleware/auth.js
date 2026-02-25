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

    // Verify user still exists and is active
    const user = await User.findById(decoded.id)
      .select('_id role emailVerified')
      .lean();
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: 'User no longer exists' });
    }

    req.user = { id: user._id.toString(), role: user.role };
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
