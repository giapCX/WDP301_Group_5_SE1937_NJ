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
  if (server)
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
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
  const hidden = await database
    .collection('vehicle_listings')
    .findOne({ status: { $ne: 'published' } });
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
  assert.ok(body.data.every((item) => item.vehicle.fuel_type === 'electric'));
  for (const path of [
    '?page=0',
    '?limit=101',
    '?minPrice=500&maxPrice=100',
    '?sort=__proto__',
    '?q=one&q=two',
    '/invalid-id',
  ]) {
    assert.equal((await fetch(`${baseUrl}/api/listings${path}`)).status, 400, path);
  }
  const literalRegex = await fetch(`${baseUrl}/api/listings?q=${encodeURIComponent('.*')}`);
  assert.equal(literalRegex.status, 200);
  assert.equal((await literalRegex.json()).pagination.total, 0);
});

test('homepage exposes effective policy values and actual listing counts', async () => {
  const response = await fetch(`${baseUrl}/api/homepage`);
  assert.equal(response.status, 200);
  const { data } = await response.json();
  const listings = await (await fetch(`${baseUrl}/api/listings?limit=100`)).json();
  assert.equal(data.totalListings, listings.pagination.total);
  assert.deepEqual(
    new Set(data.cities),
    new Set(listings.data.map((item) => item.pickup_location.city)),
  );
  assert.equal(data.policies.depositRefundBusinessDays, 3);
  assert.equal(data.policies.commissionPercent, 15);
  assert.equal(data.policies.freeCancellationHours, 48);
  assert.equal(data.updated_by_manager_id, undefined);
});

test('rental search excludes overlapping bookings and availability blocks', async () => {
  const booking = await database.collection('bookings').findOne({ status: 'ongoing' });
  assert.ok(booking);
  const query = new URLSearchParams({
    startAt: booking.start_at.toISOString(),
    endAt: booking.end_at.toISOString(),
    limit: 100,
  });
  const response = await fetch(`${baseUrl}/api/listings?${query}`);
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.ok(data.every((item) => item.vehicle_id !== booking.vehicle_id.toHexString()));
  for (const listing of data) {
    const conflicts = await database.collection('bookings').countDocuments({
      vehicle_id: new ObjectId(listing.vehicle_id),
      status: { $in: ['pending', 'awaiting_payment', 'confirmed', 'ongoing'] },
      start_at: { $lt: booking.end_at },
      end_at: { $gt: booking.start_at },
    });
    assert.equal(conflicts, 0);
    const stored = await database
      .collection('vehicle_listings')
      .findOne({ _id: new ObjectId(listing._id) });
    assert.ok(
      stored.availability_blocks.every(
        (block) => !(block.start_at < booking.end_at && block.end_at > booking.start_at),
      ),
    );
  }
  const city = new URLSearchParams({ city: 'Hà Nội' });
  const cityResponse = await (await fetch(`${baseUrl}/api/listings?${city}`)).json();
  assert.ok(cityResponse.data.length > 0);
  assert.ok(cityResponse.data.every((item) => item.pickup_location.city === 'Hà Nội'));
  for (const parameters of [
    'startAt=bad',
    'startAt=2026-10-29T09:00:00Z&endAt=2026-10-28T09:00:00Z',
  ]) {
    assert.equal((await fetch(`${baseUrl}/api/listings?${parameters}`)).status, 400);
  }
});
