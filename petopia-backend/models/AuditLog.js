const mongoose = require('mongoose');

/**
 * AuditLog Model — Security & Compliance audit trail
 *
 * Tracks security-sensitive events for PIPEDA compliance:
 * - Authentication events (login, failed login, logout)
 * - Account changes (password change, profile update, deletion)
 * - Data access (data export, consent changes)
 * - Administrative actions
 *
 * Logs are immutable — no update/delete endpoints exposed.
 * TTL index auto-expires logs after 2 years (PIPEDA reasonable retention).
 */
const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null for failed login attempts with unknown user
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Authentication
        'login_success',
        'login_failed',
        'logout',
        // Registration & Verification
        'register',
        'email_verified',
        // Account changes
        'password_changed',
        'profile_updated',
        'privacy_updated',
        // Consent & Compliance
        'terms_accepted',
        'privacy_policy_accepted',
        'notification_preferences_updated',
        // Data management
        'data_export_requested',
        'account_deletion_requested',
        'account_deleted',
        // Security events
        'fcm_token_registered',
        'fcm_token_removed',
      ],
    },
    details: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true, // createdAt = event timestamp
  },
);

// Index for querying by user
auditLogSchema.index({ user: 1, createdAt: -1 });

// Index for querying by action type
auditLogSchema.index({ action: 1, createdAt: -1 });

// TTL index — auto-delete logs after 2 years (730 days)
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 730 * 24 * 60 * 60 },
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
