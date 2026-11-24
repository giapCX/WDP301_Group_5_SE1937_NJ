const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Booking, Vehicle } = require('../src/models');
const service = require('../src/services/booking.service');
const sample = require('../src/config/sample-data');

test('real replica transactions prevent overlapping approvals and roll back losing writes', async () => {
  const databaseName = `booking_concurrency_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(
    process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/?replicaSet=rentalLocal',
    { dbName: databaseName, serverSelectionTimeoutMS: 5000, autoIndex: false },
  );
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.ok(hello.setName, 'This test requires a replica set');
    await Booking.createCollection();
    await Vehicle.createCollection();
    const template = {
      ...sample.bookings[0],
      vehicle_id: 1,
      requested_seat_count: 5,
      pickup_time: new Date('2099-01-01T00:00:00Z'),
      estimated_end_time: new Date('2099-01-02T00:00:00Z'),
    };
    for (let round = 0; round < 5; round += 1) {
      await Booking.deleteMany({});
      await Vehicle.deleteMany({});
      await Vehicle.create(sample.vehicles[0]);
      await Booking.insertMany([
        { ...template, booking_id: 1 },
        { ...template, booking_id: 2 },
      ]);
      const results = await Promise.allSettled([
        service.approveBooking(1, {}, 3),
        service.approveBooking(2, {}, 3),
      ]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      const failure = results.find((result) => result.status === 'rejected');
      assert.equal(failure.reason.statusCode, 409);
      assert.equal(await Booking.countDocuments({ booking_status: 'confirmed' }), 1);
      assert.equal(await Booking.countDocuments({ booking_status: 'pending' }), 1);
      assert.equal((await Vehicle.findOne({ vehicle_id: 1 })).schedule_version, 1);
    }
    // Back-to-back bookings should both commit despite touching the same vehicle.
    await Booking.deleteMany({});
    await Booking.insertMany([
      { ...template, booking_id: 3 },
      {
        ...template,
        booking_id: 4,
        pickup_time: template.estimated_end_time,
        estimated_end_time: new Date('2099-01-03T00:00:00Z'),
      },
    ]);
    await Promise.all([
      service.approveBooking(3, {}, 3),
      service.approveBooking(4, {}, 3),
    ]);
    assert.equal(await Booking.countDocuments({ booking_status: 'confirmed' }), 2);
    assert.equal((await Vehicle.findOne({ vehicle_id: 1 })).schedule_version, 3);

    // A duplicate decision must not commit an extra version increment.
    await assert.rejects(service.approveBooking(3, {}, 3), { statusCode: 409 });
    assert.equal((await Vehicle.findOne({ vehicle_id: 1 })).schedule_version, 3);
  } finally {
    if (mongoose.connection.db?.databaseName === databaseName) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
  }
});
