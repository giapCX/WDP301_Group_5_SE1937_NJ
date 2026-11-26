const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const models = require('../src/models');
const data = require('../src/config/sample-data');
const { router: auth, attachUser } = require('../src/routes/auth.routes');
const routes = require('../src/routes/driver-dashboard.routes');
const errors = require('../middlewares/error.middleware');
const { connectTestDatabase } = require('./helpers/test-database');

test('Driver dashboard uses real assignments and isolates each authenticated driver', async () => {
  const dbName = `driver_dashboard_test_${process.pid}_${Date.now()}`;
  await connectTestDatabase(mongoose, dbName, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  let server;
  try {
    for (const [name, rows] of Object.entries(data))
      if (rows.length) await mongoose.connection.db.collection(name).insertMany(rows);
    const app = express();
    app.use(express.json());
    app.use('/api/auth', auth);
    app.use(attachUser);
    app.use('/api/driver', routes);
    app.use(errors);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    async function login(email) {
      const response = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password: 'Demo@12345' }),
      });
      assert.equal(response.status, 200);
      return response.headers.get('set-cookie').split(';')[0];
    }
    async function get(route, cookie, status = 200) {
      const response = await fetch(base + '/api/driver' + route, {
        headers: cookie ? { Cookie: cookie } : {},
      });
      assert.equal(response.status, status, route);
      return response.json();
    }
    await get('/dashboard', null, 401);
    const renter = await login('demo8@example.com');
    await get('/dashboard', renter, 403);
    const driver = await login('demo5@example.com');
    const dashboard = (await get('/dashboard', driver)).data;
    assert.equal(dashboard.stats.total, 3);
    assert.equal(dashboard.stats.completed, 2);
    assert.equal(dashboard.profile.driver_id, 1);
    assert.equal(
      dashboard.trips.items.some((item) => item.booking_id === 3),
      false,
    );
    const detail = (await get('/trips/2', driver)).data;
    assert.equal(detail.stops.length, 2);
    assert.equal(detail.booking.vehicle.vehicle_id, 1);
    assert.equal(JSON.stringify(detail).includes('password_hash'), false);
    assert.equal(JSON.stringify(detail).includes('email'), false);
    await get('/trips/3', driver, 404);
    await get('/trips/abc', driver, 400);
    await get('/dashboard?limit=11', driver, 400);
    await get('/dashboard?status=unknown', driver, 400);
    await get('/dashboard?page=0', driver, 400);
    const first = (await get('/dashboard?page=1&limit=1', driver)).data.trips;
    const second = (await get('/dashboard?page=2&limit=1', driver)).data.trips;
    assert.equal(first.total_pages, 3);
    assert.notEqual(first.items[0].booking_id, second.items[0].booking_id);
    const driver2 = await login('demo6@example.com');
    const active = (await get('/dashboard?status=active', driver2)).data;
    assert.equal(active.stats.active, 1);
    assert.equal(active.currentTrip.booking_id, 3);
    await get('/trips/2', driver2, 404);
    await models.TripAssignment.create({
      assignment_id: 999,
      booking_id: 2,
      driver_id: 1,
      assigned_by: 3,
      assigned_at: new Date(),
      assignment_status: 'rejected',
    });
    await get('/trips/2', driver, 404);
    assert.equal((await get('/dashboard', driver)).data.stats.total, 2);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.db?.databaseName === dbName)
      await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
