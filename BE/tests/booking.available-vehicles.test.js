const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { Booking, Vehicle } = require('../src/models');
const routes = require('../src/routes/booking.routes');
const errorMiddleware = require('../middlewares/error.middleware');
const data = require('../src/config/sample-data');

test('available vehicles API filters actual conflicts and returns useful errors', async () => {
  const databaseName = `available_vehicles_test_${process.pid}_${Date.now()}`;
  let server;
  await mongoose.connect(
    process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27018/?replicaSet=rentalLocal',
    { dbName: databaseName, autoIndex: false, serverSelectionTimeoutMS: 5000 },
  );
  try {
    const pickup = new Date('2099-01-02T00:00:00Z');
    const end = new Date('2099-01-03T00:00:00Z');
    const template = {
      ...data.bookings[0],
      pickup_time: pickup,
      estimated_end_time: end,
    };
    await Vehicle.insertMany(data.vehicles);
    await Booking.insertMany([
      { ...template, booking_id: 1, vehicle_id: 1 },
      { ...template, booking_id: 2, vehicle_id: 3, booking_status: 'confirmed' },
      { ...template, booking_id: 3, vehicle_id: 1 },
      {
        ...template,
        booking_id: 4,
        vehicle_id: 5,
        booking_status: 'confirmed',
        pickup_time: new Date('2099-01-01T00:00:00Z'),
        estimated_end_time: pickup,
      },
      { ...template, booking_id: 5, estimated_end_time: pickup },
      { ...template, booking_id: 6, booking_status: 'rejected' },
    ]);
    const app = express();
    app.use('/api/operator/bookings', routes);
    app.use(errorMiddleware);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/operator/bookings`;
    async function get(id, status) {
      const response = await fetch(`${base}/${id}/available-vehicles`);
      assert.equal(response.status, status);
      return response.json();
    }
    const result = await get(1, 200);
    assert.equal(result.success, true);
    assert.equal(result.data.booking_id, 1);
    // Pending requests do not reserve cars; adjacent confirmed trips do not overlap.
    assert.deepEqual(
      result.data.vehicles.map((vehicle) => vehicle.vehicle_id),
      [1, 2, 5],
    );
    assert.equal(
      result.data.vehicles.some((vehicle) => 'schedule_version' in vehicle),
      false,
    );
    assert.equal(
      result.data.vehicles.some((vehicle) => '_id' in vehicle),
      false,
    );
    assert.equal(await Booking.countDocuments({ booking_status: 'pending' }), 3);
    for (const [id, status] of [
      ['abc', 400],
      [999, 404],
      [2, 409],
      [5, 400],
      [6, 409],
    ]) {
      const error = await get(id, status);
      assert.equal(error.success, false);
    }
    await Vehicle.updateMany({}, { $set: { status: 'maintenance' } });
    assert.deepEqual((await get(1, 200)).data.vehicles, []);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.db?.databaseName === databaseName) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
  }
});
