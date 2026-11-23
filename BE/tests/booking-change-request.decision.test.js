const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const models = require('../src/models');
const service = require('../src/services/booking-change-request.service');
const data = require('../src/config/sample-data');
const routes = require('../src/routes/booking-change-request.routes');
const errorMiddleware = require('../middlewares/error.middleware');

test('change decisions are atomic, detect stale snapshots and enforce Operator access', async () => {
  const dbName = `change_decision_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rentalLocal', {
    dbName,
    autoIndex: false,
  });
  let server;
  try {
    for (const Model of Object.values(models)) await Model.createCollection();
    await models.TripStop.createIndexes();
    await models.BookingChangeRequest.createIndexes();
    await models.Booking.insertMany(data.bookings);
    await models.Vehicle.insertMany(data.vehicles);
    await models.TripStop.insertMany(data.trip_stops);
    await models.BookingChangeRequest.insertMany(data.booking_change_requests);
    await assert.rejects(service.rejectChangeRequest(3, {}, 3), { statusCode: 400 });
    await assert.rejects(service.approveChangeRequest(999, 3), { statusCode: 404 });
    await assert.rejects(service.approveChangeRequest(1, 3), { statusCode: 409 });
    // Conflicting approval rolls back the version and preserves the request.
    await models.Booking.create({ ...data.bookings[1], booking_id: 7 });
    await assert.rejects(service.approveChangeRequest(3, 3), { statusCode: 409 });
    assert.equal((await models.Vehicle.findOne({ vehicle_id: 1 })).schedule_version, 0);
    assert.equal(
      (await models.BookingChangeRequest.findOne({ change_request_id: 3 }))
        .request_status,
      'pending',
    );
    await models.Booking.deleteOne({ booking_id: 7 });
    const approved = await service.approveChangeRequest(3, 3);
    assert.equal(approved.request_status, 'approved');
    const booking = await models.Booking.findOne({ booking_id: 2 });
    assert.equal(
      booking.pickup_time.getTime(),
      data.booking_change_requests[2].after.pickup_time.getTime(),
    );
    assert.equal(booking.estimated_price, 1800000);
    assert.equal(await models.TripStop.countDocuments({ booking_id: 2 }), 3);
    assert.equal((await models.Vehicle.findOne({ vehicle_id: 1 })).schedule_version, 1);
    // A second request based on the old itinerary cannot overwrite the approved one.
    await models.BookingChangeRequest.create({
      ...data.booking_change_requests[2],
      change_request_id: 4,
    });
    await assert.rejects(service.approveChangeRequest(4, 3), { statusCode: 409 });
    const rejected = await service.rejectChangeRequest(
      4,
      { rejection_reason: '  Lich cu  ' },
      3,
    );
    assert.equal(rejected.rejection_reason, 'Lich cu');
    assert.equal(rejected.reviewed_by, 3);
    await assert.rejects(
      service.rejectChangeRequest(4, { rejection_reason: 'Retry' }, 3),
      { statusCode: 409 },
    );
    // Competing decisions on one pending request must have exactly one winner.
    const currentStops = await models.TripStop.find({ booking_id: 2 })
      .sort({ stop_order: 1 })
      .lean();
    const before = {
      ...data.booking_change_requests[2].after,
      trip_stops: currentStops.map(({ stop_order, location, note }) => ({
        stop_order,
        location,
        note,
      })),
    };
    await models.BookingChangeRequest.create({
      ...data.booking_change_requests[2],
      change_request_id: 5,
      before,
      after: { ...before, dropoff_location: 'Demo: New destination' },
      price_difference: 0,
    });
    const outcomes = await Promise.allSettled([
      service.approveChangeRequest(5, 3),
      service.rejectChangeRequest(5, { rejection_reason: 'Khong kha thi' }, 3),
    ]);
    assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(
      outcomes.find((item) => item.status === 'rejected').reason.statusCode,
      409,
    );
    let user;
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = user;
      next();
    });
    app.use('/requests', routes);
    app.use(errorMiddleware);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    async function patch(action, body = {}) {
      return fetch(`http://127.0.0.1:${server.address().port}/requests/3/${action}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    for (const action of ['approve', 'reject']) {
      user = undefined;
      assert.equal((await patch(action)).status, 401);
      user = { user_id: 8, role_name: 'renter', status: 'active' };
      assert.equal((await patch(action)).status, 403);
      user = { user_id: 3, role_name: 'operator', status: 'active' };
      assert.equal((await patch(action, { rejection_reason: 'Test' })).status, 409);
    }
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.db?.databaseName === dbName)
      await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
