const path = require('node:path');
const mongoose = require('mongoose');

async function addBookingReviewFields(db) {
  for (const field of ['reviewed_by', 'reviewed_at', 'rejection_reason']) {
    const result = await db.collection('bookings').updateMany(
      { [field]: { $exists: false } },
      { $set: { [field]: null } }
    );
    console.log(`bookings.${field}: added to ${result.modifiedCount} documents`);
  }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  (async () => {
    if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      dbName: process.env.SEED_DB_NAME || 'tourist_car_rental_demo',
    });
    await addBookingReviewFields(mongoose.connection.db);
    console.log(`Migration completed: ${mongoose.connection.db.databaseName}`);
  })().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}

module.exports = { addBookingReviewFields };
