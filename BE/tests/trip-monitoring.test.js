const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const models = require('../src/models');
const data = require('../src/config/sample-data');
const routes = require('../src/routes/trip-monitoring.routes');
const errors = require('../middlewares/error.middleware');

test('Trip Monitoring reads assignments, latest updates and sorted itinerary with Operator guard', async () => {
  const dbName = `monitoring_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(
    process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27018/?replicaSet=rentalLocal',
    { dbName, autoIndex: false, serverSelectionTimeoutMS: 5000 },
  );
  let server;
  try {
    for (const [name, rows] of Object.entries(data))
      await mongoose.connection.db.collection(name).insertMany(rows);
    let user;
    const app = express();
    app.use((req, res, next) => {
      req.user = user;
      next();
    });
    app.use('/trips', routes);
    app.use(errors);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    async function get(url, status = 200) {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/trips${url}`,
      );
      assert.equal(response.status, status);
      return response.json();
    }
    await get('', 401);
    user = { user_id: 6, role_name: 'driver', status: 'active' };
    await get('', 403);
    user = { user_id: 3, role_name: 'operator', status: 'active' };
    const active = (await get('')).data;
    assert.equal(active.total, 1);
    assert.equal(active.limit, 10);
    assert.equal(active.items[0].booking.booking_id, 3);
    assert.equal(active.items[0].assignment.driver.user.full_name, 'Driver Binh');
    assert.equal(active.stats.completed, 2);
    const detail = (await get('/3')).data;
    assert.equal(detail.driver.full_name, 'Driver Binh');
    assert.equal(detail.stops.length, 2);
    assert.equal(detail.stops[0].stop_order, 1);
    assert.equal(JSON.stringify(detail).includes('password_hash'), false);
    assert.equal(JSON.stringify(detail).includes('additional_charges'), false);
    assert.equal((await get('?status=all&limit=1&page=2')).data.items.length, 1);
    assert.equal((await get('?status=confirmed')).data.total, 1);
    for (const url of ['?limit=11', '?page=0', '?status=pending', '/abc'])
      await get(url, 400);
    await get('/999999', 404);
    await models.TripStatusUpdate.create({
      update_id: 999,
      booking_id: 3,
      updated_by: 6,
      trip_status: 'arrived',
      updated_at: new Date('2099-01-01T00:00:00Z'),
    });
    assert.equal((await get('')).data.items[0].latest_update.trip_status, 'arrived');
    assert.equal((await get('/3')).data.updates[0].trip_status, 'arrived');
    await models.TripAssignment.create({
      assignment_id: 999,
      booking_id: 3,
      driver_id: 2,
      assigned_by: 3,
      assigned_at: new Date(),
      assignment_status: 'cancelled',
    });
    assert.equal((await get('')).data.items[0].assignment, null);
    assert.equal((await get('/3')).data.driver, null);
    await models.Booking.deleteMany({});
    assert.deepEqual((await get('')).data.stats, {
      confirmed: 0,
      in_progress: 0,
      completed: 0,
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.db?.databaseName === dbName)
      await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
