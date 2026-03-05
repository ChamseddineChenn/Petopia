const express = require('express');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { deliverNotification } = require('../services/hybridDelivery');

const router = express.Router();

// ========================================================================
// Helper â€” send a notification + real-time push to a user
// ========================================================================
async function notify(recipientId, senderId, type, title, body, data) {
  // Don't notify yourself
  if (recipientId.toString() === senderId.toString()) return;

  const notif = await Notification.create({
    recipient: recipientId,
    sender: senderId,
    type,
    title,
    body,
    data,
  });

  const populated = await Notification.findById(notif._id)
    .populate('sender', 'name profileImage')
    .lean();

  deliverNotification(recipientId.toString(), populated);
}

// ========================================================================
//  POST  /api/posts                â€” Create a post (text / media / carousel)
// ========================================================================
router.post('/', protect, async (req, res) => {
  try {
    const { content, media, tags, location, petId } = req.body;

    // Require either text or media
    if (!content && (!media || media.length === 0)) {
      return res
        .status(400)
        .json({ success: false, message: 'Post must have text or media' });
    }

    // --- Input validation ---
    if (content && content.length > 10000) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Post content cannot exceed 10,000 characters',
        });
    }

    // Validate media array
    if (media && !Array.isArray(media)) {
      return res
        .status(400)
        .json({ success: false, message: 'Media must be an array' });
    }
    if (media && media.length > 10) {
      return res
        .status(400)
        .json({ success: false, message: 'Maximum 10 media items per post' });
    }
    const validatedMedia = (media || []).filter(
      (m) =>
        typeof m === 'object' &&
        typeof m.url === 'string' &&
        m.url.length <= 2000,
    );

    // Validate tags
    let validatedTags = [];
    if (tags && Array.isArray(tags)) {
      validatedTags = tags
        .filter((t) => typeof t === 'string' && t.length <= 50)
        .slice(0, 20);
    }

    const postData = {
      author: req.user.id,
      content: content || '',
      media: validatedMedia,
      tags: validatedTags,
      pet: petId || null,
    };

    // Attach GeoJSON location if provided (validate coordinate bounds)
    if (location && location.coordinates && location.coordinates.length === 2) {
      const [lng, lat] = location.coordinates;
      if (
        typeof lng === 'number' &&
        typeof lat === 'number' &&
        lng >= -180 &&
        lng <= 180 &&
        lat >= -90 &&
        lat <= 90
      ) {
        postData.location = {
          type: 'Point',
          coordinates: [lng, lat],
          name:
            typeof location.name === 'string'
              ? location.name.slice(0, 200)
              : '',
        };
      }
    }

    const post = await Post.create(postData);
    const populated = await Post.findById(post._id)
      .populate('author', 'name profileImage')
      .populate('pet', 'name species');

    res.status(201).json({ success: true, post: populated });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  POST  /api/posts/share/:id      â€” Share (quote-repost) another post
// ========================================================================
router.post('/share/:id', protect, async (req, res) => {
  try {
    const originalPost = await Post.findById(req.params.id);
    if (!originalPost) {
      return res
        .status(404)
        .json({ success: false, message: 'Original post not found' });
    }

    const { content, tags } = req.body;

    const sharePost = await Post.create({
      author: req.user.id,
      content: content || '',
      tags: tags || [],
      sharedPost: originalPost._id,
    });

    // Increment share counter on original (atomic)
    await Post.findByIdAndUpdate(originalPost._id, {
      $inc: { sharesCount: 1 },
    });

    const populated = await Post.findById(sharePost._id)
      .populate('author', 'name profileImage')
      .populate({
        path: 'sharedPost',
        populate: [
          { path: 'author', select: 'name profileImage' },
          { path: 'pet', select: 'name species' },
        ],
      });

    // Notify original post author
    const sender = await User.findById(req.user.id).select('name').lean();
    await notify(
      originalPost.author,
      req.user.id,
      'post_shared',
      'Post Shared',
      `${sender?.name || 'Someone'} shared your post`,
      { postId: originalPost._id, userId: req.user.id },
    );

    res.status(201).json({ success: true, post: populated });
  } catch (error) {
    console.error('Share post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  GET   /api/posts/feed            â€” Discovery feed (geo + interest ranked)
// ========================================================================
router.get('/feed', protect, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(req.user.id)
      .select('interests lastKnownLocation blockedUsers following')
      .lean();

    const userInterests = currentUser?.interests || [];
    const userCoords = currentUser?.lastKnownLocation?.coordinates; // [lng, lat]
    const blocked = (currentUser?.blockedUsers || []).map((id) =>
      id.toString(),
    );

    // -----------------------------------------------------------------
    // Build aggregation pipeline
    // -----------------------------------------------------------------
    const pipeline = [];

    // Stage 1: $geoNear (must be first if used) â€” prioritise nearby posts
    if (userCoords && userCoords.length === 2) {
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: userCoords },
          distanceField: 'distance',
          maxDistance: 500000, // 500 km (same country / region)
          spherical: true,
          query: { deleted: { $ne: true } },
        },
      });
    } else {
      // No location: just filter non-deleted
      pipeline.push({ $match: { deleted: { $ne: true } } });
    }

    // Stage 2: Exclude blocked users
    if (blocked.length > 0) {
      pipeline.push({
        $match: {
          author: {
            $nin: blocked.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      });
    }

    // Stage 2b: Exclude private users' posts (unless current user follows them)
    const following = (currentUser?.following || []).map(
      (id) => new mongoose.Types.ObjectId(id.toString()),
    );
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: '_authorInfo',
        pipeline: [{ $project: { isPrivate: 1 } }],
      },
    });
    pipeline.push({
      $match: {
        $or: [
          { '_authorInfo.isPrivate': { $ne: true } },
          { author: new mongoose.Types.ObjectId(req.user.id) },
          ...(following.length > 0 ? [{ author: { $in: following } }] : []),
        ],
      },
    });
    pipeline.push({ $project: { _authorInfo: 0 } });

    // Stage 3: Interest boost â€” add a score field
    if (userInterests.length > 0) {
      pipeline.push({
        $addFields: {
          interestScore: {
            $size: {
              $ifNull: [{ $setIntersection: ['$tags', userInterests] }, []],
            },
          },
        },
      });
    } else {
      pipeline.push({ $addFields: { interestScore: 0 } });
    }

    // Stage 4: Sort â€” interest match first, then recency
    pipeline.push({
      $sort: { interestScore: -1, createdAt: -1 },
    });

    // Stage 5: Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Stage 6: Populate author
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'author',
        pipeline: [{ $project: { name: 1, profileImage: 1 } }],
      },
    });
    pipeline.push({ $unwind: '$author' });

    // Stage 7: Populate pet (optional)
    pipeline.push({
      $lookup: {
        from: 'pets',
        localField: 'pet',
        foreignField: '_id',
        as: 'pet',
        pipeline: [{ $project: { name: 1, species: 1 } }],
      },
    });
    pipeline.push({
      $unwind: { path: '$pet', preserveNullAndEmptyArrays: true },
    });

    // Stage 8: Populate sharedPost (if it's a quote-repost)
    pipeline.push({
      $lookup: {
        from: 'posts',
        localField: 'sharedPost',
        foreignField: '_id',
        as: 'sharedPost',
      },
    });
    pipeline.push({
      $unwind: { path: '$sharedPost', preserveNullAndEmptyArrays: true },
    });
    // Populate sharedPost.author
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'sharedPost.author',
        foreignField: '_id',
        as: 'sharedPost._author',
        pipeline: [{ $project: { name: 1, profileImage: 1 } }],
      },
    });
    pipeline.push({
      $addFields: {
        'sharedPost.author': {
          $ifNull: [{ $arrayElemAt: ['$sharedPost._author', 0] }, null],
        },
      },
    });
    pipeline.push({ $project: { 'sharedPost._author': 0 } });

    // Nullify sharedPost when it was originally empty (lookup creates an
    // object even for null values which breaks the frontend truthy check)
    pipeline.push({
      $addFields: {
        sharedPost: {
          $cond: {
            if: { $ifNull: ['$sharedPost._id', false] },
            then: '$sharedPost',
            else: '$$REMOVE',
          },
        },
      },
    });

    // Stage 9: Add isLiked flag for the current user
    pipeline.push({
      $addFields: {
        isLiked: {
          $in: [
            new mongoose.Types.ObjectId(req.user.id),
            { $ifNull: ['$likes', []] },
          ],
        },
      },
    });

    // Stage 10: Remove the full likes array from response (save bandwidth)
    pipeline.push({ $project: { likes: 0 } });

    const posts = await Post.aggregate(pipeline);

    // Get total for pagination (without geo constraint for count)
    const total = await Post.countDocuments({ deleted: { $ne: true } });

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

// ========================================================================
//  GET   /api/posts/mine            â€” Current user's posts
// ========================================================================
router.get('/mine', protect, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user.id })
      .populate('author', 'name profileImage')
      .populate('pet', 'name species')
      .populate({
        path: 'sharedPost',
        populate: { path: 'author', select: 'name profileImage' },
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, posts, count: posts.length });
  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  GET   /api/posts/user/:userId    â€” Another user's posts
// ========================================================================
router.get('/user/:userId', protect, async (req, res) => {
  try {
    // Privacy check: if the target user has a private profile,
    // only allow the owner or followers to see their posts
    const targetUser = await User.findById(req.params.userId)
      .select('isPrivate followers')
      .lean();
    if (!targetUser) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const isOwner = req.user.id === req.params.userId;
    const isFollower = (targetUser.followers || []).some(
      (f) => f.toString() === req.user.id,
    );

    if (targetUser.isPrivate && !isOwner && !isFollower) {
      return res.json({ success: true, posts: [], count: 0 });
    }

    const posts = await Post.find({ author: req.params.userId })
      .populate('author', 'name profileImage')
      .populate('pet', 'name species')
      .populate({
        path: 'sharedPost',
        populate: { path: 'author', select: 'name profileImage' },
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, posts, count: posts.length });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  GET   /api/posts/:id             â€” Single post detail
// ========================================================================
router.get('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'name profileImage')
      .populate('pet', 'name species')
      .populate({
        path: 'sharedPost',
        populate: { path: 'author', select: 'name profileImage' },
      });

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: 'Post not found' });
    }

    const isLiked = post.likes.some((id) => id.toString() === req.user.id);

    const postObj = post.toObject();
    postObj.isLiked = isLiked;
    delete postObj.likes; // Don't send full array

    res.json({ success: true, post: postObj });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  PUT   /api/posts/:id             â€” Edit a post (author only)
// ========================================================================
router.put('/:id', protect, async (req, res) => {
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

    const { content, media, tags, location } = req.body;

    if (content !== undefined) post.content = content;
    if (media !== undefined) post.media = media;
    if (tags !== undefined) post.tags = tags;
    if (location !== undefined) {
      if (
        location &&
        location.coordinates &&
        location.coordinates.length === 2
      ) {
        post.location = {
          type: 'Point',
          coordinates: location.coordinates,
          name: location.name || '',
        };
      } else {
        post.location = undefined;
      }
    }

    await post.save();

    const populated = await Post.findById(post._id)
      .populate('author', 'name profileImage')
      .populate('pet', 'name species');

    res.json({ success: true, post: populated });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  DELETE /api/posts/:id            â€” Soft-delete a post (author only)
// ========================================================================
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

    post.deleted = true;
    await post.save();

    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  PUT   /api/posts/:id/like        â€” Toggle like (atomic)
// ========================================================================
router.put('/:id/like', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    const post = await Post.findById(postId).select('likes likesCount author');
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: 'Post not found' });
    }

    const alreadyLiked = post.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      // Unlike â€” atomic pull + decrement
      await Post.findByIdAndUpdate(postId, {
        $pull: { likes: userId },
        $inc: { likesCount: -1 },
      });
    } else {
      // Like â€” atomic push + increment
      await Post.findByIdAndUpdate(postId, {
        $addToSet: { likes: userId },
        $inc: { likesCount: 1 },
      });

      // Notify post author
      const sender = await User.findById(userId).select('name').lean();
      await notify(
        post.author,
        userId,
        'post_liked',
        'Post Liked',
        `${sender?.name || 'Someone'} liked your post`,
        { postId: post._id, userId },
      );
    }

    res.json({
      success: true,
      isLiked: !alreadyLiked,
      likesCount: post.likesCount + (alreadyLiked ? -1 : 1),
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  POST  /api/posts/:id/comments    â€” Add a comment
// ========================================================================
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { content, parentCommentId } = req.body;
    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Comment text is required' });
    }
    if (content.length > 2000) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Comment cannot exceed 2000 characters',
        });
    }

    const comment = await Comment.create({
      post: req.params.id,
      author: req.user.id,
      content: content.trim(),
      parentComment: parentCommentId || null,
    });

    // Increment comment counter on post (atomic)
    await Post.findByIdAndUpdate(req.params.id, {
      $inc: { commentsCount: 1 },
    });

    const populated = await Comment.findById(comment._id)
      .populate('author', 'name profileImage')
      .lean();

    // Notify post author
    const sender = await User.findById(req.user.id).select('name').lean();
    await notify(
      post.author,
      req.user.id,
      'post_commented',
      'New Comment',
      `${sender?.name || 'Someone'} commented on your post`,
      { postId: post._id, commentId: comment._id, userId: req.user.id },
    );

    res.status(201).json({ success: true, comment: populated });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  GET   /api/posts/:id/comments    â€” List comments for a post (paginated)
// ========================================================================
router.get('/:id/comments', protect, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const comments = await Comment.find({
      post: req.params.id,
      deleted: { $ne: true },
      parentComment: null, // top-level only
    })
      .populate('author', 'name profileImage')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Attach isLiked flag
    const userId = req.user.id;
    const enriched = comments.map((c) => ({
      ...c,
      isLiked: (c.likes || []).some((id) => id.toString() === userId),
      likes: undefined, // strip full array
    }));

    const total = await Comment.countDocuments({
      post: req.params.id,
      deleted: { $ne: true },
      parentComment: null,
    });

    res.json({
      success: true,
      comments: enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  GET   /api/posts/:id/comments/:commentId/replies â€” Replies to a comment
// ========================================================================
router.get('/:id/comments/:commentId/replies', protect, async (req, res) => {
  try {
    const replies = await Comment.find({
      post: req.params.id,
      parentComment: req.params.commentId,
      deleted: { $ne: true },
    })
      .populate('author', 'name profileImage')
      .sort({ createdAt: 1 })
      .lean();

    const userId = req.user.id;
    const enriched = replies.map((c) => ({
      ...c,
      isLiked: (c.likes || []).some((id) => id.toString() === userId),
      likes: undefined,
    }));

    res.json({ success: true, replies: enriched });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  PUT   /api/posts/comments/:commentId/like â€” Toggle like on a comment
// ========================================================================
router.put('/comments/:commentId/like', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = req.params.commentId;

    const comment = await Comment.findById(commentId).select(
      'likes likesCount author post',
    );
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: 'Comment not found' });
    }

    const alreadyLiked = comment.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      await Comment.findByIdAndUpdate(commentId, {
        $pull: { likes: userId },
        $inc: { likesCount: -1 },
      });
    } else {
      await Comment.findByIdAndUpdate(commentId, {
        $addToSet: { likes: userId },
        $inc: { likesCount: 1 },
      });

      // Notify comment author
      const sender = await User.findById(userId).select('name').lean();
      await notify(
        comment.author,
        userId,
        'comment_liked',
        'Comment Liked',
        `${sender?.name || 'Someone'} liked your comment`,
        { postId: comment.post, commentId: comment._id, userId },
      );
    }

    res.json({
      success: true,
      isLiked: !alreadyLiked,
      likesCount: comment.likesCount + (alreadyLiked ? -1 : 1),
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  DELETE /api/posts/comments/:commentId â€” Delete a comment (author only)
// ========================================================================
router.delete('/comments/:commentId', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: 'Comment not found' });
    }
    if (comment.author.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized' });
    }

    comment.deleted = true;
    await comment.save();

    // Decrement comment counter on post (atomic)
    await Post.findByIdAndUpdate(comment.post, {
      $inc: { commentsCount: -1 },
    });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  PUT   /api/posts/location        â€” Update current user's location
// ========================================================================
router.put('/location', protect, async (req, res) => {
  try {
    const { longitude, latitude } = req.body;
    if (longitude == null || latitude == null) {
      return res
        .status(400)
        .json({ success: false, message: 'longitude and latitude required' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      lastKnownLocation: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
    });

    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  PUT   /api/posts/interests       â€” Update current user's interests
// ========================================================================
router.put('/interests', protect, async (req, res) => {
  try {
    const { interests } = req.body;
    if (!Array.isArray(interests)) {
      return res
        .status(400)
        .json({ success: false, message: 'interests must be an array' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      interests: interests.map((i) => i.toLowerCase().trim()).filter(Boolean),
    });

    res.json({ success: true, message: 'Interests updated' });
  } catch (error) {
    console.error('Update interests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================================================
//  GET   /api/posts/search/users?q= â€” Atlas Search fuzzy user search
// ========================================================================
router.get('/search/users', protect, async (req, res) => {
  try {
    const query = req.query.q || '';
    if (!query.trim()) {
      return res.json({ success: true, users: [] });
    }

    // Atlas Search ($search) â€” requires an Atlas Search index named "users_search"
    // on the "users" collection with the "name" field mapped as type: autocomplete or string.
    //
    // If the Atlas Search index is not yet created, fall back to a regex search.
    let users;

    try {
      users = await User.aggregate([
        {
          $search: {
            index: 'users_search', // â† name of your Atlas Search index
            text: {
              query: query.trim(),
              path: 'name',
              fuzzy: {
                maxEdits: 1, // Levenshtein distance â€” "Jon" â†’ "John"
                prefixLength: 1,
              },
            },
          },
        },
        { $limit: 20 },
        {
          $project: {
            name: 1,
            profileImage: 1,
            bio: 1,
            score: { $meta: 'searchScore' },
          },
        },
      ]);
    } catch (atlasSearchError) {
      // Fallback: regex search (works without Atlas Search index)
      console.warn(
        'Atlas Search not available, falling back to regex:',
        atlasSearchError.message,
      );
      const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      users = await User.find({
        name: { $regex: escaped, $options: 'i' },
      })
        .select('name profileImage bio')
        .limit(20)
        .lean();
    }

    res.json({ success: true, users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
