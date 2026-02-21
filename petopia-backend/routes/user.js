const express = require('express');
const User = require('../models/User');
const Pet = require('../models/Pet');
const Post = require('../models/Post');
const FollowRequest = require('../models/FollowRequest');
const Notification = require('../models/Notification');
const VetClinic = require('../models/VetClinic');
const GroomerShop = require('../models/GroomerShop');
const { protect } = require('../middleware/auth');
const { sendToUser } = require('../socket');
const { getPresence } = require('../services/hybridDelivery');

const router = express.Router();

// ====== Public profile (before global protect) ======
// GET /api/user/:userId/public
router.get('/:userId/public', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const isOwnProfile = req.user.id === req.params.userId;
    const isFollowing = user.followers.some(
      (f) => f.toString() === req.user.id,
    );

    // Check for pending follow request
    let followRequestStatus = null;
    if (!isOwnProfile && !isFollowing) {
      const existingRequest = await FollowRequest.findOne({
        from: req.user.id,
        to: req.params.userId,
        status: 'pending',
      });
      if (existingRequest) followRequestStatus = 'pending';
    }

    const petsCount = await Pet.countDocuments({ owner: req.params.userId });
    const postsCount = await Post.countDocuments({ author: req.params.userId });

    // Decide what to show based on privacy
    const canViewFull = isOwnProfile || isFollowing || !user.isPrivate;

    const profile = {
      _id: user._id,
      name: user.name,
      profileImage: user.profileImage,
      bio: user.bio,
      role: user.role,
      isPrivate: user.isPrivate,
      petsCount,
      postsCount,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      isFollowing,
      followRequestStatus,
      isOwnProfile,
      createdAt: user.createdAt,
    };

    // Add optional fields based on privacy settings
    if (user.showLocation || isOwnProfile || isFollowing) {
      profile.location = user.location;
      profile.city = user.city;
      profile.country = user.country;
    }
    if (user.showEmail || isOwnProfile) {
      profile.email = user.email;
    }
    if (canViewFull) {
      profile.gender = user.gender;
      profile.dateOfBirth = user.dateOfBirth;
      profile.phone = isOwnProfile ? user.phone : undefined;
    }

    // Get pets and posts only if profile is viewable
    let pets = [];
    let posts = [];
    let shop = null;

    if (canViewFull) {
      pets = await Pet.find({ owner: req.params.userId })
        .select('name species breed profileImage gender dateOfBirth')
        .lean();
      posts = await Post.find({ author: req.params.userId })
        .populate('pet', 'name species')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      // Add likes count
      posts = posts.map((p) => ({
        ...p,
        likesCount: p.likes ? p.likes.length : 0,
        commentsCount: p.comments ? p.comments.length : 0,
      }));
    }

    // Check if user owns a shop/clinic
    if (user.role === 'vet') {
      const clinic = await VetClinic.findOne({ owner: req.params.userId })
        .select('_id clinicName logo averageRating totalReviews isActive')
        .lean();
      if (clinic) shop = { type: 'vet', ...clinic };
    } else if (user.role === 'groomer') {
      const groomerShop = await GroomerShop.findOne({
        owner: req.params.userId,
      })
        .select('_id shopName logo averageRating totalReviews isActive')
        .lean();
      if (groomerShop) shop = { type: 'groomer', ...groomerShop };
    }

    res.json({
      success: true,
      profile,
      pets,
      posts,
      shop,
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// All routes below require authentication
router.use(protect);

// @route   GET /api/user/profile
// @desc    Get current user profile with stats
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const petsCount = await Pet.countDocuments({ owner: req.user.id });
    const postsCount = await Post.countDocuments({ author: req.user.id });

    const userObj = user.toObject();
    userObj.petsCount = petsCount;
    userObj.postsCount = postsCount;
    userObj.followersCount = user.followers ? user.followers.length : 0;
    userObj.followingCount = user.following ? user.following.length : 0;

    res.json({ success: true, user: userObj });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile
router.put('/profile', async (req, res) => {
  try {
    const allowedFields = ['name', 'bio', 'location', 'phone', 'profileImage'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res
      .status(500)
      .json({ success: false, message: error.message || 'Server error' });
  }
});

// @route   PUT /api/user/change-password
// @desc    Change password
router.put('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    const user = await User.findById(req.user.id).select('+password');
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/user/account
// @desc    Delete user account and all associated data
router.delete('/account', async (req, res) => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    if (password) {
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: 'Password is incorrect' });
      }
    }

    // Delete all user's pets and posts
    await Pet.deleteMany({ owner: req.user.id });
    await Post.deleteMany({ author: req.user.id });
    await User.findByIdAndDelete(req.user.id);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ====== Follow / Unfollow ======

// POST /api/user/:userId/follow
router.post('/:userId/follow', async (req, res) => {
  try {
    if (req.user.id === req.params.userId) {
      return res
        .status(400)
        .json({ success: false, message: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const alreadyFollowing = targetUser.followers.some(
      (f) => f.toString() === req.user.id,
    );
    if (alreadyFollowing) {
      return res
        .status(400)
        .json({ success: false, message: 'Already following this user' });
    }

    // If private account, create a follow request
    if (targetUser.isPrivate) {
      const existing = await FollowRequest.findOne({
        from: req.user.id,
        to: req.params.userId,
      });
      if (existing && existing.status === 'pending') {
        return res
          .status(400)
          .json({ success: false, message: 'Follow request already sent' });
      }
      let followReq;
      if (existing && existing.status === 'rejected') {
        existing.status = 'pending';
        await existing.save();
        followReq = existing;
      } else {
        followReq = await FollowRequest.create({
          from: req.user.id,
          to: req.params.userId,
        });
      }

      // Notify the target about the follow request
      const currentUser = await User.findById(req.user.id);
      const notif = await Notification.create({
        recipient: req.params.userId,
        sender: req.user.id,
        type: 'follow_request',
        title: 'Follow Request',
        body: `${currentUser.name} wants to follow you`,
        data: { followRequestId: followReq._id, userId: req.user.id },
      });
      const populated = await notif.populate('sender', 'name profileImage');
      sendToUser(req.params.userId, 'notification', populated);

      return res.json({
        success: true,
        status: 'requested',
        message: 'Follow request sent',
      });
    }

    // Public account: follow directly
    targetUser.followers.push(req.user.id);
    await targetUser.save();

    const currentUser = await User.findById(req.user.id);
    currentUser.following.push(req.params.userId);
    await currentUser.save();

    // Notify the target about the new follower
    const notif = await Notification.create({
      recipient: req.params.userId,
      sender: req.user.id,
      type: 'new_follower',
      title: 'New Follower',
      body: `${currentUser.name} started following you`,
      data: { userId: req.user.id },
    });
    const populated = await notif.populate('sender', 'name profileImage');
    sendToUser(req.params.userId, 'notification', populated);

    res.json({
      success: true,
      status: 'following',
      followersCount: targetUser.followers.length,
    });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/user/:userId/follow
router.delete('/:userId/follow', async (req, res) => {
  try {
    if (req.user.id === req.params.userId) {
      return res
        .status(400)
        .json({ success: false, message: 'Cannot unfollow yourself' });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    // Remove from followers
    targetUser.followers = targetUser.followers.filter(
      (f) => f.toString() !== req.user.id,
    );
    await targetUser.save();

    // Remove from following
    const currentUser = await User.findById(req.user.id);
    currentUser.following = currentUser.following.filter(
      (f) => f.toString() !== req.params.userId,
    );
    await currentUser.save();

    // Also cancel any pending follow request
    await FollowRequest.deleteOne({ from: req.user.id, to: req.params.userId });

    res.json({
      success: true,
      status: 'not_following',
      followersCount: targetUser.followers.length,
    });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ====== Follow Requests ======

// GET /api/user/follow-requests
router.get('/follow-requests/list', async (req, res) => {
  try {
    const requests = await FollowRequest.find({
      to: req.user.id,
      status: 'pending',
    })
      .populate('from', 'name profileImage bio')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get follow requests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/user/follow-requests/:requestId/accept
router.put('/follow-requests/:requestId/accept', async (req, res) => {
  try {
    const request = await FollowRequest.findById(req.params.requestId);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: 'Request not found' });
    }
    if (request.to.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    // Add follower
    const targetUser = await User.findById(request.to);
    if (!targetUser.followers.includes(request.from)) {
      targetUser.followers.push(request.from);
      await targetUser.save();
    }

    const fromUser = await User.findById(request.from);
    if (!fromUser.following.includes(request.to)) {
      fromUser.following.push(request.to);
      await fromUser.save();
    }

    request.status = 'accepted';
    await request.save();

    // Notify the requester that their follow request was accepted
    const acceptor = await User.findById(req.user.id);
    const notif = await Notification.create({
      recipient: request.from.toString(),
      sender: req.user.id,
      type: 'follow_request_accepted',
      title: 'Follow Request Accepted',
      body: `${acceptor.name} accepted your follow request`,
      data: { userId: req.user.id },
    });
    const populated = await notif.populate('sender', 'name profileImage');
    sendToUser(request.from.toString(), 'notification', populated);

    res.json({ success: true, message: 'Follow request accepted' });
  } catch (error) {
    console.error('Accept follow request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/user/follow-requests/:requestId/reject
router.put('/follow-requests/:requestId/reject', async (req, res) => {
  try {
    const request = await FollowRequest.findById(req.params.requestId);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: 'Request not found' });
    }
    if (request.to.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    request.status = 'rejected';
    await request.save();

    res.json({ success: true, message: 'Follow request rejected' });
  } catch (error) {
    console.error('Reject follow request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ====== Privacy Settings ======

// PUT /api/user/privacy
router.put('/privacy', async (req, res) => {
  try {
    const allowedFields = ['isPrivate', 'showLocation', 'showEmail'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      privacy: {
        isPrivate: user.isPrivate,
        showLocation: user.showLocation,
        showEmail: user.showEmail,
      },
    });
  } catch (error) {
    console.error('Update privacy error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/user/privacy
router.get('/privacy', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'isPrivate showLocation showEmail',
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      privacy: {
        isPrivate: user.isPrivate,
        showLocation: user.showLocation,
        showEmail: user.showEmail,
      },
    });
  } catch (error) {
    console.error('Get privacy error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ====== Followers / Following Lists ======

// GET /api/user/:userId/followers
router.get('/:userId/followers', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('followers', 'name profileImage bio')
      .lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, users: user.followers || [] });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/user/:userId/following
router.get('/:userId/following', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('following', 'name profileImage bio')
      .lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, users: user.following || [] });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// POST /api/user/fcm-token
// Register or update an FCM push token for the current device
// Body: { token, device? }
// ========================================
router.post('/fcm-token', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, device } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: 'Token is required' });
    }

    // Remove this token from any other user (token migration)
    await User.updateMany(
      { _id: { $ne: userId } },
      { $pull: { fcmTokens: { token } } },
    );

    // Upsert the token for this user
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const existingIdx = user.fcmTokens.findIndex((t) => t.token === token);
    if (existingIdx >= 0) {
      user.fcmTokens[existingIdx].device = device || 'unknown';
      user.fcmTokens[existingIdx].updatedAt = new Date();
    } else {
      user.fcmTokens.push({
        token,
        device: device || 'unknown',
        updatedAt: new Date(),
      });
    }

    await user.save();
    res.json({ success: true, message: 'FCM token registered' });
  } catch (error) {
    console.error('FCM token registration error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// DELETE /api/user/fcm-token
// Remove an FCM token (e.g., on logout)
// Body: { token }
// ========================================
router.delete('/fcm-token', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: 'Token is required' });
    }

    await User.findByIdAndUpdate(userId, {
      $pull: { fcmTokens: { token } },
    });

    res.json({ success: true, message: 'FCM token removed' });
  } catch (error) {
    console.error('FCM token removal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// GET /api/user/:userId/presence
// Get a user's online status and last seen time
// ========================================
router.get('/:userId/presence', protect, async (req, res) => {
  try {
    const presence = await getPresence(req.params.userId);
    res.json({ success: true, ...presence });
  } catch (error) {
    console.error('Get presence error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
