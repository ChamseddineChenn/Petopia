const AuditLog = require('../models/AuditLog');

/**
 * Log a security/compliance audit event.
 *
 * Usage:
 *   await audit(req, 'login_success', userId, 'User logged in');
 *   await audit(req, 'login_failed', null, 'Invalid credentials', { email });
 *
 * @param {Object} req - Express request (for IP + user-agent). Can be null.
 * @param {string} action - One of the AuditLog action enum values
 * @param {string|null} userId - User ObjectId, or null for anonymous events
 * @param {string} [details] - Human-readable description
 * @param {Object} [metadata] - Additional structured data
 */
const audit = async (req, action, userId, details = '', metadata = {}) => {
  try {
    await AuditLog.create({
      user: userId || null,
      action,
      details,
      ipAddress: req
        ? req.ip ||
          req.headers['x-forwarded-for'] ||
          req.connection?.remoteAddress
        : null,
      userAgent: req ? req.headers['user-agent'] || null : null,
      metadata,
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error('Audit log error:', err.message);
  }
};

module.exports = { audit };
