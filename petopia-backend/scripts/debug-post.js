// Quick debug: fetch the feed and print the first post to see its shape
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    const db = mongoose.connection.db;

    // Get any post
    const posts = await db.collection('posts').find({}).limit(1).toArray();
    if (posts.length === 0) {
      console.log('No posts in DB');
      await mongoose.disconnect();
      process.exit(0);
    }

    const post = posts[0];
    console.log('\n=== Raw Post Document ===');
    console.log('_id:', post._id);
    console.log('author:', post.author, '(type:', typeof post.author, ')');
    console.log(
      'createdAt:',
      post.createdAt,
      '(type:',
      typeof post.createdAt,
      ')',
    );
    console.log('content:', post.content?.substring(0, 50));
    console.log('media count:', post.media?.length);
    console.log('location:', JSON.stringify(post.location));

    // Check what the aggregate would return
    const pipeline = [
      { $match: { deleted: { $ne: true } } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author',
          pipeline: [{ $project: { name: 1, profileImage: 1 } }],
        },
      },
      { $unwind: '$author' },
    ];

    const aggResult = await db
      .collection('posts')
      .aggregate(pipeline)
      .toArray();
    if (aggResult.length > 0) {
      const agg = aggResult[0];
      console.log('\n=== Aggregated Post ===');
      console.log('author:', JSON.stringify(agg.author));
      console.log(
        'createdAt:',
        agg.createdAt,
        '(type:',
        typeof agg.createdAt,
        ')',
      );
      console.log('JSON createdAt:', JSON.stringify(agg.createdAt));
    }

    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
