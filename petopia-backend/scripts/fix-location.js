const mongoose = require('mongoose');
require('dotenv').config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    // Check for any posts with location but no location.type
    const bad = await db
      .collection('posts')
      .find({
        location: { $exists: true, $ne: null },
        'location.type': { $exists: false },
      })
      .toArray();
    console.log('Bad documents found:', bad.length);
    if (bad.length > 0) {
      bad.forEach((d) =>
        console.log('  ->', d._id, JSON.stringify(d.location)),
      );
    }
    // Fix them
    if (bad.length > 0) {
      const result = await db
        .collection('posts')
        .updateMany(
          { _id: { $in: bad.map((d) => d._id) } },
          { $unset: { location: '' } },
        );
      console.log('Fixed:', result.modifiedCount);
    }
    // Also count total posts
    const total = await db.collection('posts').countDocuments();
    console.log('Total posts:', total);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
