// One-time script: backfill existing users with new security fields
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    const result = await mongoose.connection.db.collection('users').updateMany(
      { tokenVersion: { $exists: false } },
      { $set: { tokenVersion: 0, roleVerified: true, loginAttempts: 0, lockUntil: null } }
    );
    console.log('Updated', result.modifiedCount, 'users');
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
