/**
 * Hybrid Delivery Controller
 * ===========================
 * Industry-standard real-time + push notification delivery.
 *
 * Strategy:
 *  1. If the recipient has an ACTIVE socket connection → emit via Socket.IO (instant)
 *  2. If the recipient is OFFLINE → send via FCM push notification (battery-efficient)
 *  3. For critical events → send BOTH (belt-and-suspenders for reliability)
 *
 * Message types:
 *  - "data" messages: silent, handled by client code (badge updates, sync triggers)
 *  - "notification" messages: shown in system tray when app is in background
 *
 * Presence:
 *  - Socket connect/disconnect tracked automatically
 *  - lastSeen updated on disconnect for "last active" feature
 *  - Heartbeat via Socket.IO ping/pong (already configured at 25s interval)
 */

// NOTE: socket.js is lazy-required inside functions to break the
// circular dependency (socket.js → hybridDelivery.js → socket.js).
const User = require('../models/User');

function _socket() {
  return require('../socket');
}

// ========================================
// FCM Admin (lazy-init)
// ========================================

let fcmAdmin = null;

/**
 * Initialize Firebase Admin SDK.
 * Call this once at server startup if you have a service account.
 * If no service account is configured, FCM is silently disabled.
 */
function initFCM() {
  try {
    const admin = require('firebase-admin');

    // Check if already initialized
    if (admin.apps.length > 0) {
      fcmAdmin = admin;
      return;
    }

    // Try to load service account from env or file
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountPath) {
      const path = require('path');
      const fs = require('fs');
      // Resolve to absolute path within current project, validate it stays in config/
      const resolved = path.resolve(__dirname, '..', serviceAccountPath);
      const configDir = path.resolve(__dirname, '..', 'config');
      if (!resolved.startsWith(configDir)) {
        throw new Error(
          'Firebase service account path must be within the config/ directory',
        );
      }
      const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      fcmAdmin = admin;
      console.log('[FCM] Firebase Admin SDK initialized');
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Use Application Default Credentials (for GCP/Cloud Run)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
      fcmAdmin = admin;
      console.log('[FCM] Firebase Admin SDK initialized (ADC)');
    } else {
      console.log(
        '[FCM] No Firebase credentials found — push notifications disabled',
      );
    }
  } catch (err) {
    console.warn('[FCM] Failed to initialize:', err.message);
    console.log(
      '[FCM] Push notifications disabled — app will use socket-only delivery',
    );
  }
}

/**
 * Check if FCM is available
 */
function isFCMAvailable() {
  return fcmAdmin !== null;
}

// ========================================
// Core Delivery Logic
// ========================================

/**
 * Deliver a real-time event to a user using the optimal channel.
 *
 * @param {string} userId - Target user ID
 * @param {string} event - Socket.IO event name
 * @param {object} data - Event payload
 * @param {object} [options] - Delivery options
 * @param {boolean} [options.forcePush=false] - Always send FCM even if user is online
 * @param {string} [options.pushTitle] - FCM notification title
 * @param {string} [options.pushBody] - FCM notification body
 * @param {object} [options.pushData] - FCM data payload (always delivered to client code)
 * @param {boolean} [options.silent=false] - Send as data-only FCM (no visible notification)
 * @param {string} [options.collapseKey] - FCM collapse key (replaces previous notification)
 * @param {'high'|'normal'} [options.priority='high'] - FCM priority
 */
async function deliver(userId, event, data, options = {}) {
  const {
    forcePush = false,
    pushTitle,
    pushBody,
    pushData,
    silent = false,
    collapseKey,
    priority = 'high',
  } = options;

  const { isUserOnline, sendToUser } = _socket();
  const online = isUserOnline(userId);

  // 1. Always try socket delivery (instant, zero battery cost)
  if (online) {
    sendToUser(userId, event, data);
  }

  // 2. FCM delivery when offline (or forced)
  if ((!online || forcePush) && isFCMAvailable()) {
    await sendFCM(userId, {
      event,
      data,
      title: pushTitle,
      body: pushBody,
      pushData,
      silent: silent || online, // If online, make it silent (data-only)
      collapseKey,
      priority,
    });
  }

  // 3. If no socket AND no FCM → log (message will be delivered on next connect via markDeliveredOnConnect)
  if (!online && !isFCMAvailable()) {
    // Messages are already persisted in DB; markDeliveredOnConnect handles catch-up
    // This is a valid fallback — just won't get push notification
  }
}

/**
 * Send FCM push notification to a user's registered devices.
 */
async function sendFCM(userId, opts) {
  if (!fcmAdmin) return;

  try {
    const user = await User.findById(userId).select('fcmTokens').lean();
    if (!user?.fcmTokens?.length) return;

    const tokens = user.fcmTokens.map((t) => t.token);
    const staleTokens = [];

    // Build message
    const message = {
      data: {
        event: opts.event,
        payload: JSON.stringify(opts.data || {}),
        ...(opts.pushData || {}),
      },
      android: {
        priority: opts.priority,
        ...(opts.collapseKey && { collapseKey: opts.collapseKey }),
        ...(opts.silent
          ? {}
          : {
              notification: {
                title: opts.title || 'Petopia',
                body: opts.body || 'You have a new notification',
                channelId: 'default',
              },
            }),
      },
      apns: {
        headers: {
          'apns-priority': opts.priority === 'high' ? '10' : '5',
          ...(opts.collapseKey && { 'apns-collapse-id': opts.collapseKey }),
        },
        payload: {
          aps: {
            ...(opts.silent
              ? { 'content-available': 1 }
              : {
                  alert: {
                    title: opts.title || 'Petopia',
                    body: opts.body || 'You have a new notification',
                  },
                  sound: 'default',
                }),
            'mutable-content': 1,
          },
        },
      },
    };

    // Send to each token
    const results = await Promise.allSettled(
      tokens.map(async (token) => {
        try {
          await fcmAdmin.messaging().send({ ...message, token });
        } catch (err) {
          // Token is stale/invalid → mark for removal
          if (
            err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token'
          ) {
            staleTokens.push(token);
          } else {
            console.warn(`[FCM] Send error for user ${userId}:`, err.message);
          }
        }
      }),
    );

    // Clean up stale tokens
    if (staleTokens.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { token: { $in: staleTokens } } },
      });
      console.log(
        `[FCM] Removed ${staleTokens.length} stale tokens for user ${userId}`,
      );
    }
  } catch (err) {
    console.error(`[FCM] Failed to send to user ${userId}:`, err.message);
  }
}

// ========================================
// Convenience Methods
// ========================================

/**
 * Deliver a new chat message notification
 */
async function deliverChatMessage(recipientId, messageData, conversationData) {
  const senderName =
    typeof messageData.sender === 'object'
      ? messageData.sender.name
      : 'Someone';

  await deliver(
    recipientId,
    'new_message',
    {
      message: messageData,
      conversationId: conversationData?._id?.toString() || '',
      conversation: conversationData,
    },
    {
      pushTitle: senderName,
      pushBody: messageData.text?.substring(0, 100) || 'Sent a message',
      pushData: {
        type: 'chat_message',
        conversationId: conversationData?._id?.toString() || '',
      },
      collapseKey: `chat_${conversationData?._id}`,
      priority: 'high',
    },
  );
}

/**
 * Deliver an unread count update (silent data message)
 */
async function deliverUnreadCount(userId, totalUnread) {
  await deliver(
    userId,
    'unread_count_update',
    { totalUnread },
    {
      silent: true,
      pushData: {
        type: 'unread_count',
        totalUnread: String(totalUnread),
      },
      collapseKey: 'unread_count',
      priority: 'normal',
    },
  );
}

/**
 * Deliver a generic notification (follow, like, comment, etc.)
 */
async function deliverNotification(userId, notification) {
  await deliver(userId, 'notification', notification, {
    pushTitle: notification.title || 'Petopia',
    pushBody:
      notification.message ||
      notification.body ||
      'You have a new notification',
    pushData: {
      type: 'notification',
      notificationId: notification._id?.toString() || '',
    },
    priority: 'high',
  });
}

// ========================================
// Presence Helpers
// ========================================

/**
 * Update user's lastSeen timestamp.
 * Called automatically on socket disconnect.
 */
async function updateLastSeen(userId) {
  try {
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
  } catch (err) {
    console.error(
      `[Presence] Failed to update lastSeen for ${userId}:`,
      err.message,
    );
  }
}

/**
 * Get a user's online status and last seen time.
 */
async function getPresence(userId) {
  const { isUserOnline } = _socket();
  const online = isUserOnline(userId);
  if (online) {
    return { online: true, lastSeen: null };
  }
  const user = await User.findById(userId).select('lastSeen').lean();
  return { online: false, lastSeen: user?.lastSeen || null };
}

module.exports = {
  initFCM,
  isFCMAvailable,
  deliver,
  deliverChatMessage,
  deliverUnreadCount,
  deliverNotification,
  updateLastSeen,
  getPresence,
};
