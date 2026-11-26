const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const { addEmbeddedCharges } = require('./add-embedded-charges');
const data = require('../src/config/sample-data');
const { addVehicleScheduleVersion } = require('./add-vehicle-schedule-version');
const { addBookingReviewFields } = require('./add-booking-review-fields');
const ID_FIELD_BY_COLLECTION = Object.freeze({
  booking_change_requests: 'change_request_id',
  roles: 'role_id',
  users: 'user_id',
  driver_profiles: 'driver_id',
  vehicles: 'vehicle_id',
  bookings: 'booking_id',
  trip_stops: 'stop_id',
  trip_assignments: 'assignment_id',
  trip_status_updates: 'update_id',
  pricing_rules: 'rule_id',
  service_policies: 'policy_id',
  payments: 'payment_id',
  refunds: 'refund_id',
  vehicle_inspections: 'inspection_id',
  maintenance_records: 'maintenance_id',
  incidents: 'incident_id',
  reviews: 'review_id',
});
const unique = {
  roles: ['role_name'],
  users: ['email'],
  driver_profiles: ['user_id', 'license_number'],
  vehicles: ['plate_number'],
  reviews: ['booking_id'],
};
async function main() {
  const vehiclesOnly = process.argv.includes('--vehicles-only');
  const collections = Object.entries(data).map(([name, rows]) => {
    const key = ID_FIELD_BY_COLLECTION[name];
    if (!key) throw new Error(`Missing sample ID mapping for ${name}`);
    return { name, rows, key };
  });
  const selected = vehiclesOnly ? collections.filter(({ name }) => name === 'vehicles') : collections;
  if (process.argv.includes('--check')) {
    for (const { name, rows } of selected)
      console.log(`${name}: ${rows.length}`);
    console.log('Sample data loaded successfully; no database changes.');
    return;
  }
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  const db = mongoose.connection.db;
  for (const { name, rows, key } of selected) {
    const collection = db.collection(name);
    await collection.createIndex({ [key]: 1 }, { unique: true });
    for (const field of unique[name] || [])
      await collection.createIndex({ [field]: 1 }, { unique: true });
    if (name === 'booking_change_requests') {
      const { BookingChangeRequest } = require('../src/models');
      for (const row of rows) await new BookingChangeRequest(row).validate();
      for (const [fields, options] of BookingChangeRequest.schema.indexes()) {
        await collection.createIndex(fields, options);
      }
    }
    if (name === 'pricing_rules') {
      const { PricingRule } = require('../src/models');
      for (const row of rows) await new PricingRule(row).validate();
      for (const [fields, options] of PricingRule.schema.indexes()) await collection.createIndex(fields, options);
    }
    if (name === 'service_policies') {
      const { ServicePolicy } = require('../src/models');
      for (const row of rows) await new ServicePolicy(row).validate();
      for (const [fields, options] of ServicePolicy.schema.indexes()) await collection.createIndex(fields, options);
    }
    if (name === 'trip_stops')
      await collection.createIndex({ booking_id: 1, stop_order: 1 }, { unique: true });
    // Only insert missing demo IDs; never overwrite an existing document.
    const result = rows.length
      ? await collection.bulkWrite(
          rows.map((row) => ({
            updateOne: {
              filter: { [key]: row[key] },
              update: { $setOnInsert: row },
              upsert: true,
            },
          })),
        )
      : { upsertedCount: 0, matchedCount: 0 };
    console.log(
      `${name}: inserted ${result.upsertedCount}, existing ${result.matchedCount}`,
    );
  }
  if (!vehiclesOnly) {
    await addEmbeddedCharges(db);
    await addBookingReviewFields(db);
    await addVehicleScheduleVersion(db);
  }
  console.log(`Seed completed: ${db.databaseName}`);
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
