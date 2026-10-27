import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { connectDatabase, closeDatabase } from '../src/config/database.js';

let database;
let server;
let baseUrl;

before(async () => {
  database = await connectDatabase();
  server = createApp(database).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await closeDatabase();
});

test('health checks the actual MongoDB connection', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: database.databaseName });
});

test('seed stores BSON types and public listings omit private vehicle fields', async () => {
  const stored = await database.collection('vehicles').findOne();
  assert.ok(stored, 'Run npm run db:seed before these integration tests.');
  assert.ok(stored._id instanceof ObjectId);
  assert.ok(stored.created_at instanceof Date);
  const response = await fetch(`${baseUrl}/api/listings?limit=2&sort=price_asc`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.data.length > 0);
  assert.ok(body.data.length <= 2);
  assert.ok(body.pagination.total >= body.data.length);
  for (const item of body.data) {
    assert.equal(item.vehicle.owner_id, undefined);
    assert.equal(item.vehicle.documents, undefined);
    assert.equal(item.vehicle.vin, undefined);
    assert.equal(item.created_by_operation_staff_id, undefined);
  }
  const detail = await fetch(`${baseUrl}/api/listings/${body.data[0]._id}`);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).data._id, body.data[0]._id);
});

test('unpublished listings and internal collections are not publicly exposed', async () => {
  const hidden = await database.collection('vehicle_listings').findOne({ status: { $ne: 'published' } });
  assert.ok(hidden, 'The group seed contains suspended and archived listings.');
  assert.equal((await fetch(`${baseUrl}/api/listings/${hidden._id}`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/users`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/payment_transactions`)).status, 404);
});

test('filters work and invalid inputs return 400 rather than an internal error', async () => {
  const response = await fetch(`${baseUrl}/api/listings?fuelType=electric&minPrice=0`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.data.length > 0);
  assert.ok(body.data.every(item => item.vehicle.fuel_type === 'electric'));
  for (const path of ['?page=0', '?limit=101', '?minPrice=500&maxPrice=100', '?sort=__proto__', '?q=one&q=two', '/invalid-id']) {
    assert.equal((await fetch(`${baseUrl}/api/listings${path}`)).status, 400, path);
  }
  const literalRegex = await fetch(`${baseUrl}/api/listings?q=${encodeURIComponent('.*')}`);
  assert.equal(literalRegex.status, 200);
  assert.equal((await literalRegex.json()).pagination.total, 0);
});
