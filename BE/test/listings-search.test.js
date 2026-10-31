import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { MongoClient, ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';

// Disposable, uniquely named database; never writes to the application database.
const client = new MongoClient(env.mongoUri, {
  serverSelectionTimeoutMS: 5000,
});
const db = client.db(`xedi_search_test_${randomUUID().replaceAll('-', '')}`);
const vehicleIds = Array.from({ length: 5 }, () => new ObjectId());
const listingIds = Array.from({ length: 5 }, () => new ObjectId());
const from = new Date('2026-11-10T10:00:00Z');
const until = new Date('2026-11-12T10:00:00Z');
let server;
let baseUrl;
before(async () => {
  await client.connect();
  await db.collection('vehicles').insertMany(
    vehicleIds.map((_id, index) => ({
      _id,
      brand: 'Test Brand',
      model: index === 0 ? 'Needle' : `Model ${index}`,
      manufacture_year: index === 0 ? 2024 : 2020,
      seats: index === 0 ? 7 : 5,
      vehicle_type: index === 0 ? 'SUV' : 'Sedan',
      fuel_type: index === 0 ? 'electric' : 'gasoline',
      transmission: 'automatic',
      onboarding_status: index === 4 ? 'rejected' : 'approved',
      physical_status: 'at_garage',
      vin: 'private-vin',
      owner_id: new ObjectId(),
    })),
  );
  await db.collection('vehicle_listings').insertMany(
    listingIds.map((_id, index) => ({
      _id,
      vehicle_id: vehicleIds[index],
      status: 'published',
      title: `Listing ${index}`,
      daily_price: (index + 1) * 500000,
      pickup_location: { city: index === 0 ? 'Hà Nội' : 'Hải Phòng' },
      availability_blocks:
        index === 3 ? [{ start_at: from, end_at: until }] : [],
    })),
  );
  await db.collection('bookings').insertMany([
    {
      vehicle_id: vehicleIds[0],
      status: 'confirmed',
      start_at: from,
      end_at: until,
    },
    {
      vehicle_id: vehicleIds[1],
      status: 'cancelled',
      start_at: from,
      end_at: until,
    },
    {
      vehicle_id: vehicleIds[2],
      status: 'confirmed',
      start_at: new Date('2026-11-09T10:00:00Z'),
      end_at: from,
    },
  ]);
  server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/api/listings`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try {
    await db.dropDatabase();
  } finally {
    await client.close();
  }
});
async function search(params = {}) {
  const response = await fetch(`${baseUrl}?${new URLSearchParams(params)}`);
  assert.equal(response.status, 200);
  return response.json();
}

test('combines keyword on vehicle model, city, multiple types, price, seats and year', async () => {
  const body = await search({
    q: 'needle',
    city: 'Hà Nội',
    vehicleType: 'suv,sedan',
    fuelType: 'electric',
    transmission: 'automatic',
    minPrice: '500000',
    maxPrice: '500000',
    seats: '7',
    minYear: '2023',
  });
  assert.deepEqual(
    body.data.map((item) => item._id),
    [listingIds[0].toString()],
  );
  assert.equal(body.data[0].vehicle.vin, undefined);
  assert.equal(body.data[0].vehicle.owner_id, undefined);
  assert.equal((await search({ q: '.*' })).pagination.total, 0);
  assert.equal((await search({ city: '.*' })).pagination.total, 0);
});
test('sorts and paginates the full result, including saved IDs and empty saved list', async () => {
  const first = await search({ sort: 'price_asc', limit: '2', page: '1' });
  const second = await search({ sort: 'price_asc', limit: '2', page: '2' });
  assert.deepEqual(first.pagination, {
    page: 1,
    limit: 2,
    total: 4,
    totalPages: 2,
  });
  assert.equal(first.data[0].daily_price, 500000);
  assert.equal(second.data[0].daily_price, 1500000);
  assert.equal(
    (await search({ sort: 'price_desc' })).data[0].daily_price,
    2000000,
  );
  assert.equal((await search({ ids: '' })).pagination.total, 0);
  assert.equal(
    (await search({ ids: listingIds[0].toString() })).pagination.total,
    1,
  );
});
test('excludes overlapping bookings/blocks, allows touching boundaries and cancelled bookings', async () => {
  const body = await search({
    startAt: from.toISOString(),
    endAt: until.toISOString(),
  });
  assert.deepEqual(
    body.data.map((item) => item._id).sort(),
    [listingIds[1], listingIds[2]].map(String).sort(),
  );
  assert.ok(body.data.every((item) => item.conflicts === undefined));
  const boundary = await search({
    startAt: until.toISOString(),
    endAt: '2026-11-13T10:00:00Z',
  });
  assert.equal(boundary.pagination.total, 4);
});
test('rejects malformed dates, filters and unsafe parameter shapes', async () => {
  for (const query of [
    'startAt=bad&endAt=bad',
    'startAt=2026-11-10T10:00:00Z',
    'startAt=2026-02-30T10:00:00Z&endAt=2026-03-02T10:00:00Z',
    'startAt=2026-11-12T10:00:00Z&endAt=2026-11-10T10:00:00Z',
    'vehicleType=suv,unknown',
    'fuelType=bad',
    'transmission=bad',
    'minYear=abc',
    'seats=0',
    'ids=invalid',
    'q=a&q=b',
    'page=0',
    'minPrice=1000&maxPrice=1',
    'sort=__proto__',
  ])
    assert.equal((await fetch(`${baseUrl}?${query}`)).status, 400, query);
});
