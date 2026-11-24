const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
(async () => {
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const result = await mongoose.connection.db
    .collection('bookings')
    .updateMany(
      { requested_seat_count: { $exists: false } },
      { $set: { requested_seat_count: null } },
    );
  console.log(
    `Initialized ${result.modifiedCount} bookings; renter requirements remain unknown until supplied.`,
  );
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
