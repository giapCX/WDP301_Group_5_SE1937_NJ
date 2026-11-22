const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const data = require('../src/config/sample-data');
const { addBookingReviewFields } = require('./add-booking-review-fields');
const keys = ['role_id','user_id','driver_id','vehicle_id','booking_id','stop_id','assignment_id','update_id','promotion_id','booking_id','payment_id','refund_id','inspection_id','maintenance_id','incident_id','review_id'];
const unique = {roles:['role_name'],users:['email'],driver_profiles:['user_id','license_number'],vehicles:['plate_number'],promotions:['code'],reviews:['booking_id']};
async function main() {
  if (process.argv.includes('--check')) {
    for (const [name, rows] of Object.entries(data)) console.log(`${name}: ${rows.length}`);
    console.log('Sample data loaded successfully; no database changes.');
    return;
  }
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000, dbName: process.env.SEED_DB_NAME || 'tourist_car_rental_demo' });
  const db = mongoose.connection.db;
  for (const [i, [name, rows]] of Object.entries(data).entries()) {
    const collection = db.collection(name);
    const key = keys[i];
    await collection.createIndex({[key]:1},{unique:true});
    for (const field of unique[name] || []) await collection.createIndex({[field]:1},{unique:true});
    if (name === 'trip_stops') await collection.createIndex({booking_id:1,stop_order:1},{unique:true});
    // Only insert missing demo IDs; never overwrite an existing document.
    const result = await collection.bulkWrite(rows.map(row=>({updateOne:{filter:{[key]:row[key]},update:{$setOnInsert:row},upsert:true}})));
    console.log(`${name}: inserted ${result.upsertedCount}, existing ${result.matchedCount}`);
  }
  await addBookingReviewFields(db);
  console.log(`Seed completed: ${db.databaseName}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());

