import { readFile, readdir } from 'node:fs/promises';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

const sampleDirectory = new URL('../data/sample/', import.meta.url);
const databaseName = process.env.SAMPLE_DB_NAME
  || process.env.SEED_DB_NAME
  || 'tourist_car_rental_demo';
const primaryKeys = {
  booking_change_requests: 'change_request_id',
  booking_promotions: 'booking_id',
  bookings: 'booking_id',
  driver_profiles: 'driver_id',
  incidents: 'incident_id',
  maintenance_records: 'maintenance_id',
  payments: 'payment_id',
  promotions: 'promotion_id',
  refunds: 'refund_id',
  reviews: 'review_id',
  roles: 'role_id',
  trip_assignments: 'assignment_id',
  trip_status_updates: 'update_id',
  trip_stops: 'stop_id',
  users: 'user_id',
  vehicle_inspections: 'inspection_id',
  vehicles: 'vehicle_id',
};
const uniqueFields = {
  roles: ['role_name'],
  users: ['email'],
  driver_profiles: ['user_id', 'license_number'],
  vehicles: ['plate_number'],
  promotions: ['code'],
  reviews: ['booking_id'],
};
async function readDatasets() {
  const files = (await readdir(sampleDirectory))
    .filter((file) => file.endsWith('.json'))
    .sort();
  const expected = Object.keys(primaryKeys).sort();
  if (files.map((file) => file.slice(0, -5)).join('\n') !== expected.join('\n')) {
    throw new Error('BE/data/sample must contain the expected 17 collection JSON files.');
  }

  return Promise.all(files.map(async (file) => {
    const name = file.slice(0, -5);
    const content = await readFile(new URL(file, sampleDirectory), 'utf8');
    const documents = mongoose.mongo.BSON.EJSON.parse(content.replace(/^\uFEFF/, ''), { relaxed: true });
    const key = primaryKeys[name];
    if (!Array.isArray(documents) || documents.some((document) => document[key] === undefined)) {
      throw new Error(`${file} must contain an array with ${key} on every document.`);
    }
    const values = documents.map((document) => document[key]);
    if (new Set(values).size !== values.length) {
      throw new Error(`${file} contains duplicate ${key} values.`);
    }
    return { name, key, documents };
  }));
}

let connection;
try {
  const datasets = await readDatasets();
  connection = await mongoose.createConnection(env.mongoUri, {
    dbName: databaseName,
    serverSelectionTimeoutMS: 5000,
    autoIndex: false,
    autoCreate: false,
  }).asPromise();

  for (const { name, key, documents } of datasets) {
    const collection = connection.collection(name);
    await collection.createIndex({ [key]: 1 }, { unique: true });
    for (const field of uniqueFields[name] || []) {
      await collection.createIndex({ [field]: 1 }, { unique: true });
    }
    if (name === 'trip_stops') {
      await collection.createIndex({ booking_id: 1, stop_order: 1 }, { unique: true });
    }
    const result = await collection.bulkWrite(documents.map((document) => ({
      updateOne: {
        filter: { [key]: document[key] },
        update: { $setOnInsert: document },
        upsert: true,
      },
    })));
    console.log(`${name}: ${result.upsertedCount} inserted, ${result.matchedCount} preserved.`);
  }

  console.log(`Sample data loaded into ${databaseName}. Existing records were not overwritten.`);
} catch (error) {
  console.error(`Sample database seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (connection) await connection.close();
}
