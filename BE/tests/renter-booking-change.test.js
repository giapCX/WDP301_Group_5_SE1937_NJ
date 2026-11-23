const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const models = require('../src/models');
const data = require('../src/config/sample-data');
const service = require('../src/services/renter-booking-change.service');
const routes = require('../src/routes/renter-booking-change.routes');
const errors = require('../middlewares/error.middleware');

test('renter submissions validate ownership, price and serialize pending requests', async () => {
  const dbName = `renter_change_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rentalLocal', {
    dbName,
    autoIndex: false,
  });
  let server;
  try {
    for (const Model of Object.values(models)) await Model.createCollection();
    await models.BookingChangeRequest.createIndexes();
    await models.Booking.insertMany(data.bookings);
    await models.Vehicle.insertMany(data.vehicles);
    await models.TripStop.insertMany(data.trip_stops);
    const input = {
      reason: 'Đổi giờ đón',
      after: {
        pickup_time: '2026-12-03T03:00:00Z',
        estimated_end_time: '2026-12-06T03:00:00Z',
      },
      requested_by: 999,
      before: {},
      request_status: 'approved',
    };
    await assert.rejects(service.createChangeRequest(2, input, 7), { statusCode: 403 });
    await assert.rejects(service.createChangeRequest(999, input, 8), { statusCode: 404 });
    await assert.rejects(
      service.createChangeRequest(2, { reason: 'Test', after: {} }, 8),
      { statusCode: 400 },
    );
    await assert.rejects(
      service.createChangeRequest(
        2,
        { reason: 'Test', after: { estimated_price: 1 } },
        8,
      ),
      { statusCode: 400 },
    );
    await assert.rejects(
      service.createChangeRequest(2, { reason: 'Test', after: { pickup_time: null } }, 8),
      { statusCode: 400 },
    );
    const results = await Promise.allSettled([
      service.createChangeRequest(2, input, 8),
      service.createChangeRequest(2, input, 8),
    ]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(
      results.find((item) => item.status === 'rejected').reason.statusCode,
      409,
    );
    const request = results.find((item) => item.status === 'fulfilled').value;
    assert.equal(request.requested_by, 8);
    assert.equal(request.request_status, 'pending');
    assert.equal(request.price_difference, 800000);
    assert.equal(request.after.estimated_price, 2400000);
    assert.equal(request.before.estimated_price, 1600000);
    assert.equal(
      (await models.Booking.findOne({ booking_id: 2 })).estimated_price,
      1600000,
    );
    assert.equal(await models.TripStop.countDocuments({ booking_id: 2 }), 2);
    assert.equal(await models.BookingChangeRequest.countDocuments(), 1);
    let user;
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = user;
      next();
    });
    app.use('/api/renter/bookings', routes);
    app.use(errors);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    async function post(id = 2) {
      return fetch(
        `http://127.0.0.1:${server.address().port}/api/renter/bookings/${id}/change-requests`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
    }
    assert.equal((await post()).status, 401);
    user = { user_id: 3, role_name: 'operator', status: 'active' };
    assert.equal((await post()).status, 403);
    user = { user_id: 8, role_name: 'renter', status: 'active' };
    await models.Booking.create({ ...data.bookings[1], booking_id: 7 });
    const response = await post(7);
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.requested_by, 8);
    assert.equal((await post(7)).status, 409);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.db?.databaseName === dbName)
      await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
