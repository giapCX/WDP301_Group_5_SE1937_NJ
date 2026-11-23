const path = require('node:path');
const mongoose = require('mongoose');

async function addVehicleScheduleVersion(db) {
  const result = await db
    .collection('vehicles')
    .updateMany(
      { schedule_version: { $exists: false } },
      { $set: { schedule_version: 0 } },
    );
  console.log('Vehicle schedule versions added: ' + result.modifiedCount);
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  (async () => {
    if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      dbName: process.env.SEED_DB_NAME || 'tourist_car_rental_demo',
    });
    await addVehicleScheduleVersion(mongoose.connection.db);
    console.log(`Migration completed: ${mongoose.connection.db.databaseName}`);
  })()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { addVehicleScheduleVersion };
