const express = require('express');
const Post = require('../models/Post');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/posts/feed
// @desc    Get social feed (all posts, newest first)
router.get('/feed', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate('author', 'name profileImage')
      .populate('pet', 'name species')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments();

    res.json({
      success: true,
      posts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/posts/mine
// @desc    Get current user's posts
router.get('/mine', protect, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user.id })
      .populate('pet', 'name species')
      .sort({ createdAt: -1 });

    res.json({ success: true, posts, count: posts.length });
  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/posts
// @desc    Create a post
router.post('/', protect, async (req, res) => {
  try {
    const { content, image, petId } = req.body;

    if (!content) {
      return res
        .status(400)
        .json({ success: false, message: 'Content is required' });
    }

    const post = await Post.create({
      author: req.user.id,
      content,
      image: image || null,
      pet: petId || null,
    });

    const populated = await Post.findById(post._id)
      .populate('author', 'name profileImage')
      .populate('pet', 'name species');

    res.status(201).json({ success: true, post: populated });
  } catch (error) {
    console.error('Create post error:', error);
    res
      .status(500)
      .json({ success: false, message: error.message || 'Server error' });
  }
});

// @route   PUT /api/posts/:id/like
// @desc    Toggle like on a post
router.put('/:id/like', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: 'Post not found' });
    }

    const userId = req.user.id;
    const index = post.likes.indexOf(userId);

    if (index === -1) {
      post.likes.push(userId);
    } else {
      post.likes.splice(index, 1);
    }

    await post.save();

    res.json({
      success: true,
      likesCount: post.likes.length,
      isLiked: post.likes.includes(userId),
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post (only author)
router.delete('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: 'Post not found' });
    }
    if (post.author.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
