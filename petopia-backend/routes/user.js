const express = require('express');
const User = require('../models/User');
const Pet = require('../models/Pet');
const Post = require('../models/Post');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
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
      return res
        .status(400)
        .json({
          success: false,
          message: 'Please provide current and new password',
        });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({
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

module.exports = router;
