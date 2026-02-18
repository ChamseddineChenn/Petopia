const express = require('express');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// ========================================
// GET /api/notifications — Get user's notifications
// ========================================
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 30, unreadOnly } = req.query;
    const filter = { recipient: req.user.id };

    if (unreadOnly === 'true') {
      filter.read = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sender', 'name profileImage')
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      read: false,
    });

    res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// GET /api/notifications/unread-count — Quick badge count
// ========================================
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      read: false,
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// PUT /api/notifications/:id/read — Mark one as read
// ========================================
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { read: true },
      { new: true },
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================
// PUT /api/notifications/read-all — Mark all as read
// ========================================
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { read: true },
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
