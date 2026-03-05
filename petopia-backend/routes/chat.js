const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const FollowRequest = require('../models/FollowRequest');
const VetClinic = require('../models/VetClinic');
const GroomerShop = require('../models/GroomerShop');
const { sendToUser, isUserOnline } = require('../socket');
const {
  deliverChatMessage,
  deliverUnreadCount,
  deliver,
} = require('../services/hybridDelivery');

// ========================================
// Helper: determine if a user can message another directly
// Returns true for direct, false for message-request
// Instagram-like: it's a request if the recipient does NOT follow the sender
// ========================================
async function canMessageDirectly(senderId, recipientId) {
  const recipient = await User.findById(recipientId).select('following').lean();
  if (!recipient) return false;

  // If recipient follows the sender → direct message
  const recipientFollowsSender = recipient.following?.some(
    (f) => f.toString() === senderId.toString(),
  );
  return !!recipientFollowsSender;
}

// ========================================
// POST /api/chat/conversations
// Start or get a conversation with another user
// Body: { recipientId, text? }
// ========================================
router.post('/conversations', protect, async (req, res) => {
  try {
    const { recipientId, text, shopId, shopType } = req.body;
    const senderId = req.user.id;

    if (!recipientId) {
      return res
        .status(400)
        .json({ success: false, message: 'recipientId is required' });
    }
    if (senderId === recipientId) {
      return res
        .status(400)
        .json({ success: false, message: 'Cannot message yourself' });
    }

    // Check if either user has blocked the other
    const [sender, recipient] = await Promise.all([
      User.findById(senderId).select('blockedUsers').lean(),
      User.findById(recipientId).lean(),
    ]);
    if (!recipient) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    if (sender?.blockedUsers?.some((id) => id.toString() === recipientId)) {
      return res
        .status(403)
        .json({ success: false, message: 'You have blocked this user' });
    }
    if (recipient.blockedUsers?.some((id) => id.toString() === senderId)) {
      return res
        .status(403)
        .json({ success: false, message: 'You cannot message this user' });
    }

    // Resolve shop context if provided
    let shopContext = null;
    if (shopId && shopType) {
      if (shopType === 'clinic') {
        const clinic = await VetClinic.findById(shopId)
          .select('clinicName owner')
          .lean();
        if (clinic) {
          shopContext = {
            shopId: clinic._id,
            shopType: 'clinic',
            shopName: clinic.clinicName,
            shopOwnerId: clinic.owner,
          };
        }
      } else if (shopType === 'groomer_shop') {
        const shop = await GroomerShop.findById(shopId)
          .select('shopName owner')
          .lean();
        if (shop) {
          shopContext = {
            shopId: shop._id,
            shopType: 'groomer_shop',
            shopName: shop.shopName,
            shopOwnerId: shop.owner,
          };
        }
      }
    }

    // For shop conversations, try to find existing shop-specific conversation
    let conversation;
    if (shopContext) {
      conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId], $size: 2 },
        'shopContext.shopId': shopContext.shopId,
      });
    } else {
      // Regular conversation (no shop context)
      conversation = await Conversation.findOne({
        participants: { $all: [senderId, recipientId], $size: 2 },
        $or: [
          { 'shopContext.shopId': null },
          { 'shopContext.shopId': { $exists: false } },
          { shopContext: null },
          { shopContext: { $exists: false } },
        ],
      });
    }

    // Shop messaging always bypasses follow requirement
    const isDirect = shopContext
      ? true
      : await canMessageDirectly(senderId, recipientId);

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, recipientId],
        isAccepted: {
          [senderId]: true,
          [recipientId]: isDirect,
        },
        unreadCount: { [senderId]: 0, [recipientId]: 0 },
        ...(shopContext && { shopContext }),
      });
    }

    // If text was provided, send the first message
    if (text && text.trim()) {
      if (text.length > 5000) {
        return res
          .status(400)
          .json({
            success: false,
            message: 'Message text cannot exceed 5000 characters',
          });
      }

      const message = await Message.create({
        conversation: conversation._id,
        sender: senderId,
        text: text.trim(),
        status: 'sent',
      });

      conversation.lastMessage = message._id;
      const recipientUnread =
        (conversation.unreadCount?.get(recipientId) || 0) + 1;
      conversation.unreadCount.set(recipientId, recipientUnread);
      await conversation.save();

      // Populate and emit real-time
      const populated = await message.populate('sender', 'name profileImage');

      // Mark delivered if recipient is online
      if (isUserOnline(recipientId)) {
        message.status = 'delivered';
        message.deliveredAt = new Date();
        await message.save();

        sendToUser(senderId, 'message_status', {
          messageId: message._id,
          status: 'delivered',
          deliveredAt: message.deliveredAt,
        });
      }

      // Hybrid delivery: socket if online, FCM push if offline
      deliverChatMessage(
        recipientId,
        populated.toObject ? populated.toObject() : populated,
        {
          _id: conversation._id,
          isRequest: !conversation.isAccepted?.get(recipientId),
        },
      );
    }

    // Populate the conversation for return
    const populated = await Conversation.findById(conversation._id)
      .populate('participants', 'name profileImage bio')
      .populate('lastMessage')
      .lean();

    // Add isRequest flag for the current user
    populated.isRequest = !conversation.isAccepted?.get(senderId);

    res.json({ success: true, conversation: populated });
  } catch (error) {
    console.error('Create/get conversation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/chat/conversations
// List all conversations for the current user
// Query: ?type=direct|requests (default: direct)
// ========================================
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const type = req.query.type || 'direct';

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate('participants', 'name profileImage bio')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name profileImage' },
      })
      .sort({ updatedAt: -1 })
      .lean();

    // Filter by accepted/request status
    const filtered = conversations.filter((conv) => {
      const accepted = conv.isAccepted?.get
        ? conv.isAccepted.get(userId)
        : conv.isAccepted?.[userId];
      if (type === 'requests') return !accepted;
      return accepted !== false; // direct: accepted or undefined (legacy)
    });

    // Add unread counts and other participant info
    const result = filtered.map((conv) => {
      const otherParticipant = conv.participants.find(
        (p) => p._id.toString() !== userId,
      );
      return {
        ...conv,
        otherParticipant,
        unread: conv.unreadCount?.get
          ? conv.unreadCount.get(userId) || 0
          : conv.unreadCount?.[userId] || 0,
        shopContext: conv.shopContext || null,
      };
    });

    res.json({ success: true, conversations: result });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/chat/conversations/:id/messages
// Fetch messages for a conversation (paginated)
// Query: ?before=messageId&limit=30
// ========================================
router.get('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { before, limit: rawLimit = 30 } = req.query;
    const limit = Math.min(Math.max(parseInt(rawLimit) || 30, 1), 100);

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
    });

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: 'Conversation not found' });
    }

    const query = { conversation: id };
    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .populate('sender', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// POST /api/chat/conversations/:id/messages
// Send a message in an existing conversation
// Body: { text }
// ========================================
router.post('/conversations/:id/messages', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Message text is required' });
    }

    if (text.length > 5000) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Message text cannot exceed 5000 characters',
        });
    }

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
    });

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: 'Conversation not found' });
    }

    // Check blocked status
    const otherParticipantId = conversation.participants.find(
      (p) => p.toString() !== userId,
    );
    const [senderDoc, recipientDoc] = await Promise.all([
      User.findById(userId).select('blockedUsers').lean(),
      User.findById(otherParticipantId).select('blockedUsers').lean(),
    ]);
    if (
      senderDoc?.blockedUsers?.some(
        (bid) => bid.toString() === otherParticipantId.toString(),
      )
    ) {
      return res
        .status(403)
        .json({ success: false, message: 'You have blocked this user' });
    }
    if (recipientDoc?.blockedUsers?.some((bid) => bid.toString() === userId)) {
      return res
        .status(403)
        .json({ success: false, message: 'You cannot message this user' });
    }

    const message = await Message.create({
      conversation: id,
      sender: userId,
      text: text.trim(),
      status: 'sent',
    });

    // Update conversation
    conversation.lastMessage = message._id;
    const recipientId = conversation.participants.find(
      (p) => p.toString() !== userId,
    );

    // Re-evaluate isAccepted for the recipient in case follow status changed
    const recipientAccepted = conversation.isAccepted?.get(
      recipientId.toString(),
    );
    if (!recipientAccepted) {
      // Check if recipient now follows the sender → auto-accept
      const nowDirect = await canMessageDirectly(
        userId,
        recipientId.toString(),
      );
      if (nowDirect) {
        conversation.isAccepted.set(recipientId.toString(), true);
      }
    }

    const recipientUnread =
      (conversation.unreadCount?.get(recipientId.toString()) || 0) + 1;
    conversation.unreadCount.set(recipientId.toString(), recipientUnread);
    await conversation.save();

    const populated = await message.populate('sender', 'name profileImage');

    // Mark as delivered if recipient is online
    if (isUserOnline(recipientId.toString())) {
      message.status = 'delivered';
      message.deliveredAt = new Date();
      await message.save();

      sendToUser(userId, 'message_status', {
        messageId: message._id,
        conversationId: id,
        status: 'delivered',
        deliveredAt: message.deliveredAt,
      });
    }

    // Hybrid delivery: socket if online, FCM push if offline
    deliverChatMessage(
      recipientId.toString(),
      {
        ...populated.toObject(),
        status: message.status,
        deliveredAt: message.deliveredAt,
      },
      {
        _id: id,
        isRequest: !conversation.isAccepted?.get(recipientId.toString()),
      },
    );

    res.json({ success: true, message: populated });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// PUT /api/chat/conversations/:id/read
// Mark all messages in a conversation as read (seen)
// ========================================
router.put('/conversations/:id/read', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify participation
    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
    });

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: 'Conversation not found' });
    }

    // Mark all unread messages from other user as seen
    const now = new Date();
    const updated = await Message.updateMany(
      {
        conversation: id,
        sender: { $ne: userId },
        status: { $ne: 'seen' },
      },
      {
        $set: { status: 'seen', seenAt: now },
      },
    );

    // Reset unread counter for current user
    conversation.unreadCount.set(userId, 0);
    await conversation.save();

    // Notify the sender that messages were seen
    const otherUserId = conversation.participants.find(
      (p) => p.toString() !== userId,
    );

    if (updated.modifiedCount > 0) {
      deliver(otherUserId.toString(), 'messages_seen', {
        conversationId: id,
        seenBy: userId,
        seenAt: now,
      });
    }

    res.json({ success: true, modifiedCount: updated.modifiedCount });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// PUT /api/chat/conversations/:id/accept
// Accept a message request → moves to direct
// ========================================
router.put('/conversations/:id/accept', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
    });

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: 'Conversation not found' });
    }

    conversation.isAccepted.set(userId, true);
    await conversation.save();

    // Notify the other user
    const otherUserId = conversation.participants.find(
      (p) => p.toString() !== userId,
    );
    deliver(
      otherUserId.toString(),
      'request_accepted',
      { conversationId: id },
      {
        pushTitle: 'Message Request Accepted',
        pushBody: 'Your message request has been accepted!',
        priority: 'high',
      },
    );

    res.json({ success: true, message: 'Message request accepted' });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// DELETE /api/chat/conversations/:id
// Delete/decline a message request or conversation
// ========================================
router.delete('/conversations/:id', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
    });

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: 'Conversation not found' });
    }

    // Delete all messages in the conversation
    await Message.deleteMany({ conversation: id });
    await Conversation.findByIdAndDelete(id);

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// PUT /api/chat/mark-all-read
// Mark all conversations as read for the current user
// ========================================
router.put('/mark-all-read', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({ participants: userId });

    let totalMarked = 0;
    for (const conv of conversations) {
      const unread = conv.unreadCount?.get(userId) || 0;
      if (unread > 0) {
        // Mark messages as seen
        const updated = await Message.updateMany(
          {
            conversation: conv._id,
            sender: { $ne: userId },
            status: { $ne: 'seen' },
          },
          { $set: { status: 'seen', seenAt: new Date() } },
        );
        totalMarked += updated.modifiedCount;

        // Reset unread counter
        conv.unreadCount.set(userId, 0);
        await conv.save();

        // Notify senders
        if (updated.modifiedCount > 0) {
          const otherUserId = conv.participants.find(
            (p) => p.toString() !== userId,
          );
          if (otherUserId) {
            deliver(otherUserId.toString(), 'messages_seen', {
              conversationId: conv._id.toString(),
              seenBy: userId,
              seenAt: new Date(),
            });
          }
        }
      }
    }

    res.json({ success: true, totalMarked });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/chat/search-following?q=
// Search users the current user is following (for new message composer)
// ========================================
router.get('/search-following', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const query = req.query.q || '';

    const currentUser = await User.findById(userId).select('following').lean();
    if (!currentUser || !currentUser.following?.length) {
      return res.json({ success: true, users: [] });
    }

    const filter = {
      _id: { $in: currentUser.following },
    };

    if (query.trim()) {
      const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }

    const users = await User.find(filter)
      .select('name profileImage bio')
      .limit(20)
      .lean();

    res.json({ success: true, users });
  } catch (error) {
    console.error('Search following error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/chat/unread-count
// Get total unread count across all direct conversations
// ========================================
router.get('/unread-count', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      participants: userId,
    }).lean();

    let totalUnread = 0;
    for (const conv of conversations) {
      // Only count direct (accepted) conversations
      const accepted = conv.isAccepted?.get
        ? conv.isAccepted.get(userId)
        : conv.isAccepted?.[userId];
      if (accepted !== false) {
        const unread = conv.unreadCount?.get
          ? conv.unreadCount.get(userId) || 0
          : conv.unreadCount?.[userId] || 0;
        totalUnread += unread;
      }
    }

    // Count message requests separately
    const requestCount = conversations.filter((conv) => {
      const accepted = conv.isAccepted?.get
        ? conv.isAccepted.get(userId)
        : conv.isAccepted?.[userId];
      return !accepted;
    }).length;

    res.json({ success: true, totalUnread, requestCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// POST /api/chat/block/:userId
// Block a user from messaging you
// ========================================
router.post('/block/:userId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const targetId = req.params.userId;

    if (userId === targetId) {
      return res
        .status(400)
        .json({ success: false, message: 'Cannot block yourself' });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    // Add to blocked list (avoid duplicates)
    await User.findByIdAndUpdate(userId, {
      $addToSet: { blockedUsers: targetId },
    });

    // Delete all conversations between the two users and their messages
    const conversations = await Conversation.find({
      participants: { $all: [userId, targetId] },
    });

    const convIds = conversations.map((c) => c._id);
    if (convIds.length > 0) {
      await Message.deleteMany({ conversation: { $in: convIds } });
      await Conversation.deleteMany({ _id: { $in: convIds } });
    }

    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// DELETE /api/chat/block/:userId
// Unblock a user
// ========================================
router.delete('/block/:userId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const targetId = req.params.userId;

    await User.findByIdAndUpdate(userId, {
      $pull: { blockedUsers: targetId },
    });

    res.json({ success: true, message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/chat/blocked-users
// Get list of blocked users
// ========================================
router.get('/blocked-users', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId)
      .populate('blockedUsers', 'name profileImage')
      .lean();

    res.json({ success: true, users: user?.blockedUsers || [] });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
