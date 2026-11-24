const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const express = require('express');
const mongoose = require('mongoose');
const sample = require('../src/config/sample-data');
const { router: authRouter, attachUser } = require('../src/routes/auth.routes');
const garageRouter = require('../src/routes/garage-workflow.routes');
const tripRouters = require('../src/routes/trip-workflow.routes');
const errors = require('../middlewares/error.middleware');

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXKQAAAAASUVORK5CYII=',
  'base64',
);
const checklist = {
  exterior: 'passed', interior: 'passed', tires: 'passed', lights: 'passed',
  brakes: 'passed', fuel: 'passed', documents: 'passed', safety: 'passed',
};

test('garage records a complete checklist for the current vehicle and blocks an unsafe handover', async () => {
  const dbName = 'garage_inspection_test_' + process.pid + '_' + Date.now();
  const uri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27018/?replicaSet=rentalLocal';
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  let server;
  try {
    for (const collection of ['roles', 'users', 'driver_profiles']) {
      await db.collection(collection).insertMany(sample[collection]);
    }
    await db.collection('vehicles').insertMany([
      ...sample.vehicles,
      { ...sample.vehicles[4], vehicle_id: 6, plate_number: '51A-GARA06' },
    ]);
    const pickup = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(+pickup + 60 * 60 * 1000);
    await db.collection('bookings').insertMany([90, 91, 92].map((id, index) => ({
      ...sample.bookings[0], booking_id: id, booking_status: 'confirmed',
      vehicle_id: [2, 5, 3][index], requested_seat_count: [7, 7, 16][index],
      pickup_time: pickup, estimated_end_time: end,
    })));
    await db.collection('trip_workflows').insertOne({
      booking_id: 92, vehicle_id: 3, driver_id: 1,
      stage: 'awaiting_vehicle', driver_response: 'accepted',
    });
    await db.collection('vehicle_inspections').insertMany([
      {
        inspection_id: 81, booking_id: 92, vehicle_id: 3, staff_id: 4,
        inspection_type: 'handover', result: 'passed', inspected_at: new Date(), odometer: 500,
      },
      {
        inspection_id: 82, booking_id: 91, vehicle_id: 6, staff_id: 4,
        inspection_type: 'handover', result: 'passed', inspected_at: new Date(), odometer: 600,
      },
    ]);

    const app = express();
    app.use('/api/garage', attachUser, garageRouter);
    app.use(express.json());
    app.use('/api/auth', authRouter);
    app.use('/api/operator/dispatch', attachUser, tripRouters.operator);
    app.use('/api/driver/workflow', attachUser, tripRouters.driver);
    app.use(errors);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;

    function request(path, cookie, body) {
      return fetch(base + '/api' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...(cookie && { Cookie: cookie }), ...(body && { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }
    async function login(id) {
      const response = await request('/auth/login', null, {
        identifier: 'demo' + id + '@example.com', password: 'Demo@12345',
      });
      assert.equal(response.status, 200);
      return response.headers.get('set-cookie').split(';')[0];
    }

    const [operator, garage, driverOne, driverTwo] = await Promise.all([3, 4, 5, 6].map(login));
    const inspect = (booking, vehicle, changes = {}) => request('/garage/inspections', garage, {
      booking_id: booking, vehicle_id: vehicle, inspection_type: 'handover', result: 'passed',
      condition_note: 'Kiểm tra tình trạng xe', odometer: 1400.5, fuel_percent: 65, checklist,
      photos: [{ content_type: 'image/png', base64: png.toString('base64') }],
      ...changes,
    });
    const assign = (booking, driver, vehicle) => request('/operator/dispatch/' + booking + '/assign', operator, {
      driver_id: driver, vehicle_id: vehicle, service_type: 'one_way',
    });
    async function loadTask(id) {
      const response = await request('/garage/tasks', garage);
      assert.equal(response.status, 200);
      return (await response.json()).data.find((item) => item.booking_id === id);
    }

    const legacy = await loadTask(92);
    assert.equal(legacy.inspection.inspection_id, 81);
    assert.equal(legacy.inspection.checklist, undefined);
    assert.equal((await assign(90, 1, 2)).status, 200);
    assert.equal((await loadTask(90)).workflow_stage, 'awaiting_driver');
    assert.equal((await inspect(90, 2)).status, 409);
    assert.equal((await request('/driver/workflow/90/accept', driverOne, {})).status, 200);
    assert.equal((await request('/driver/workflow/90/vehicle_received', driverOne, {})).status, 409);
    assert.equal((await inspect(90, 5)).status, 409);
    assert.equal((await inspect(90, 2, { checklist: { tires: 'passed' } })).status, 400);
    assert.equal((await inspect(90, 2, { checklist: { ...checklist, tires: 'failed' } })).status, 400);
    assert.equal((await inspect(90, 2, { fuel_percent: 101 })).status, 400);
    assert.equal((await inspect(90, 2, { photos: [] })).status, 400);
    assert.equal((await inspect(90, 2, { photos: [{ content_type: 'image/png', base64: 'YWJj' }] })).status, 400);

    const submissions = await Promise.all([inspect(90, 2), inspect(90, 2)]);
    assert.deepEqual(submissions.map((response) => response.status).sort(), [201, 409]);
    const { inspection } = (await submissions.find((response) => response.status === 201).json()).data;
    assert.deepEqual(inspection.checklist, checklist);
    assert.equal(inspection.fuel_percent, 65);
    assert.equal(inspection.photo_count, 1);
    assert.equal(inspection.photos, undefined);
    const saved = await loadTask(90);
    assert.equal(saved.inspection.inspection_id, inspection.inspection_id);
    assert.equal(saved.inspection.photos, undefined);
    assert.equal(await db.collection('vehicle_inspections').countDocuments({ booking_id: 90 }), 1);

    const photoPath = '/garage/inspections/' + inspection.inspection_id + '/photos/1';
    assert.equal((await request(photoPath)).status, 401);
    assert.equal((await request(photoPath, operator)).status, 403);
    const photo = await request(photoPath, garage);
    assert.equal(photo.status, 200);
    assert.equal(photo.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await photo.arrayBuffer()), png);
    assert.equal((await request('/driver/workflow/90/vehicle_received', driverOne, {})).status, 200);

    assert.equal((await assign(91, 2, 5)).status, 200);
    assert.equal((await request('/driver/workflow/91/accept', driverTwo, {})).status, 200);
    assert.equal((await inspect(91, 5, { result: 'failed', checklist: { ...checklist, brakes: 'failed' } })).status, 201);
    const blocked = await loadTask(91);
    assert.equal(blocked.status, 'failed');
    assert.equal(blocked.workflow_stage, 'vehicle_replacement_required');
    assert.equal(blocked.vehicle.status, 'maintenance');
    assert.equal(await db.collection('maintenance_records').countDocuments({ vehicle_id: 5 }), 1);
    assert.equal((await request('/driver/workflow/91/vehicle_received', driverTwo, {})).status, 409);

    assert.equal((await request('/operator/dispatch/91/replace-vehicle', operator, { vehicle_id: 6 })).status, 200);
    const replacement = await loadTask(91);
    assert.equal(replacement.vehicle_id, 6);
    assert.equal(replacement.status, 'pending');
    assert.equal(replacement.inspection, undefined);
    assert.equal((await request('/driver/workflow/91/vehicle_received', driverTwo, {})).status, 409);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db.databaseName === dbName) await db.dropDatabase();
    await mongoose.disconnect();
  }
});
