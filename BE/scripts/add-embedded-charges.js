const path = require('node:path');
const mongoose = require('mongoose');

async function addEmbeddedCharges(db) {
  const result = await db
    .collection('bookings')
    .updateMany(
      { additional_charges: { $exists: false } },
      { $set: { additional_charges: [] } },
    );
  console.log(`Booking charge arrays initialized: ${result.modifiedCount}`);
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  (async () => {
    if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      dbName: process.env.SEED_DB_NAME || 'tourist_car_rental_demo',
    });
    await addEmbeddedCharges(mongoose.connection.db);
  })()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { addEmbeddedCharges };
