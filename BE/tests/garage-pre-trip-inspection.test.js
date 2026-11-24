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

test('garage verifies the current vehicle and preserves the handover, return and damage reports', async () => {
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
      { ...sample.vehicles[4], vehicle_id: 7, plate_number: '51A-GARA07' },
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
    const prepare = (booking, vehicle, inspection) => request('/garage/handovers', garage, {
      booking_id: booking, vehicle_id: vehicle, inspection_id: inspection,
    });
    const receive = (booking, driver, inspection) => request('/driver/workflow/' + booking + '/vehicle_received', driver, {
      inspection_id: inspection,
    });
    const confirmReturn = (booking, driver) => request('/driver/workflow/' + booking + '/vehicle_returned', driver, {});
    const returnCheck = (booking, vehicle, changes = {}) => inspect(booking, vehicle, {
      inspection_type: 'return', odometer: 1505, fuel_percent: 44, ...changes,
    });
    async function reportTrip(booking, driver) {
      const path = '/driver/workflow/' + booking;
      assert.equal((await request(path + '/update', driver, { kind: 'outbound_completed' })).status, 200);
      assert.equal((await request(path + '/report', driver, { end_odometer: 1500, summary: 'Đã trả khách' })).status, 200);
    }
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

    assert.equal((await receive(90, driverOne, inspection.inspection_id)).status, 409);
    assert.equal((await prepare(90, 5, inspection.inspection_id)).status, 409);
    assert.equal((await prepare(90, 2, inspection.inspection_id)).status, 201);
    assert.equal((await prepare(90, 2, inspection.inspection_id)).status, 201);
    assert.equal(await db.collection('vehicle_handovers').countDocuments({ booking_id: 90 }), 1);
    const driverPhoto = '/driver/workflow/90/handover/' + inspection.inspection_id + '/photos/1';
    assert.equal((await request(driverPhoto, driverTwo)).status, 404);
    assert.equal((await request(driverPhoto, driverOne)).status, 200);
    assert.equal((await receive(90, driverTwo, inspection.inspection_id)).status, 404);
    const driverTrips = await request('/driver/workflow', driverOne);
    assert.equal((await driverTrips.json()).data.find((item) => item.workflow.booking_id === 90).handover.inspection.fuel_percent, 65);

    const declining = '/driver/workflow/90/vehicle_declined';
    assert.equal((await request(declining, driverOne, { inspection_id: inspection.inspection_id })).status, 400);
    assert.equal((await request(declining, driverOne, {
      inspection_id: inspection.inspection_id, reason: 'Hiện trạng khác ảnh kiểm tra',
    })).status, 200);
    assert.equal((await loadTask(90)).handover.status, 'declined');
    assert.equal((await receive(90, driverOne, inspection.inspection_id)).status, 409);
    assert.equal((await request('/driver/workflow/90/update', driverOne, { kind: 'arrived_pickup' })).status, 409);
    assert.equal((await request('/garage/handovers/' + inspection.inspection_id + '/recheck', garage, {})).status, 200);
    assert.equal((await loadTask(90)).inspection, undefined);

    const newCheck = await inspect(90, 2);
    assert.equal(newCheck.status, 201);
    const nextId = (await newCheck.json()).data.inspection.inspection_id;
    assert.equal((await prepare(90, 2, nextId)).status, 201);
    assert.equal((await receive(90, driverOne, inspection.inspection_id)).status, 409);
    const pastPickup = new Date(Date.now() - 60 * 1000);
    await db.collection('bookings').updateOne({ booking_id: 90 }, { $set: { pickup_time: pastPickup } });
    assert.equal((await receive(90, driverOne, nextId)).status, 409);
    await db.collection('bookings').updateOne({ booking_id: 90 }, { $set: { pickup_time: pickup } });
    const replies = await Promise.all([receive(90, driverOne, nextId), receive(90, driverOne, nextId)]);
    assert.deepEqual(replies.map((response) => response.status).sort(), [200, 409]);
    assert.equal((await db.collection('vehicles').findOne({ vehicle_id: 2 })).status, 'in_use');
    assert.equal((await db.collection('vehicle_handovers').findOne({ inspection_id: inspection.inspection_id })).status, 'declined');
    const archived = await request('/garage/tasks/handover-90/2', garage);
    const { data: archive } = await archived.json();
    assert.equal(archive.archived, true);
    assert.equal(archive.handover.status, 'accepted');
    assert.equal(archive.handover.responded_by, 5);

    assert.equal((await assign(91, 2, 5)).status, 200);
    assert.equal((await request('/driver/workflow/91/accept', driverTwo, {})).status, 200);
    assert.equal((await inspect(91, 5, { result: 'failed', checklist: { ...checklist, brakes: 'failed' } })).status, 201);
    const blocked = await loadTask(91);
    assert.equal(blocked.status, 'failed');
    assert.equal(blocked.workflow_stage, 'vehicle_replacement_required');
    assert.equal(blocked.vehicle.status, 'maintenance');
    assert.equal(await db.collection('maintenance_records').countDocuments({ vehicle_id: 5 }), 1);
    assert.equal((await request('/driver/workflow/91/vehicle_received', driverTwo, {})).status, 409);

    assert.equal((await request('/driver/workflow/90/update', driverOne, { kind: 'picked_up' })).status, 200);
    await db.collection('bookings').updateOne({ booking_id: 90 }, { $set: { pickup_time: pastPickup } });
    assert.equal((await request('/driver/workflow/90/incident', driverOne, {
      kind: 'vehicle_failure', description: 'Xe không thể tiếp tục chuyến',
    })).status, 200);
    assert.equal((await request('/operator/dispatch/90/replace-vehicle', operator, { vehicle_id: 7 })).status, 200);
    const replacedCheck = await inspect(90, 7);
    assert.equal(replacedCheck.status, 201);
    const replacedId = (await replacedCheck.json()).data.inspection.inspection_id;
    assert.equal((await prepare(90, 7, replacedId)).status, 201);
    const receiveReplacement = await receive(90, driverOne, replacedId);
    assert.equal(receiveReplacement.status, 200);
    assert.equal((await receiveReplacement.json()).data.stage, 'outbound');

    assert.equal((await request('/operator/dispatch/91/replace-vehicle', operator, { vehicle_id: 6 })).status, 200);
    const replacement = await loadTask(91);
    assert.equal(replacement.vehicle_id, 6);
    assert.equal(replacement.status, 'pending');
    assert.equal(replacement.inspection, undefined);
    assert.equal((await request('/driver/workflow/91/vehicle_received', driverTwo, {})).status, 409);

    await reportTrip(90, driverOne);
    assert.equal((await confirmReturn(90, driverOne)).status, 409);
    const returnPath = '/garage/tasks/return-90/7';
    const { data: beforeReturn } = await (await request(returnPath, garage)).json();
    assert.equal(beforeReturn.before_inspection.inspection_id, replacedId);
    assert.equal(beforeReturn.reported_odometer, 1500);
    assert.equal((await returnCheck(90, 2)).status, 409);
    assert.equal((await returnCheck(90, 7, { odometer: 1400 })).status, 400);
    const failDetails = { result: 'failed', checklist: { ...checklist, brakes: 'failed' } };
    const returnSubmissions = await Promise.all([returnCheck(90, 7, failDetails), returnCheck(90, 7, failDetails)]);
    assert.deepEqual(returnSubmissions.map((response) => response.status).sort(), [201, 409]);
    const { data: afterReturn } = await (await request(returnPath, garage)).json();
    assert.equal(afterReturn.inspection.before_inspection_id, replacedId);
    assert.equal(afterReturn.inspection.checklist.brakes, 'failed');
    assert.equal(afterReturn.inspection.fuel_percent, 44);
    assert.equal(afterReturn.inspection.odometer, 1505);
    assert.equal(Number.isFinite(Date.parse(afterReturn.inspection.inspected_at)), true);
    assert.equal(afterReturn.inspection.staff_id, 4);
    const returnPhoto = await request('/garage/inspections/' + afterReturn.inspection.inspection_id + '/photos/1', garage);
    assert.deepEqual(Buffer.from(await returnPhoto.arrayBuffer()), png);
    assert.equal(await db.collection('maintenance_records').countDocuments({ vehicle_id: 7 }), 1);
    assert.equal((await confirmReturn(90, driverTwo)).status, 404);
    assert.equal((await confirmReturn(90, driverOne)).status, 200);
    assert.equal((await confirmReturn(90, driverOne)).status, 409);
    assert.equal((await db.collection('bookings').findOne({ booking_id: 90 })).booking_status, 'completed');
    assert.equal((await db.collection('vehicles').findOne({ vehicle_id: 7 })).status, 'maintenance');
    const { data: closedReturn } = await (await request(returnPath, garage)).json();
    assert.equal(closedReturn.archived, true);
    assert.ok(closedReturn.confirmed_at);
    assert.equal(closedReturn.before_inspection.inspection_id, replacedId);

    const failedId = closedReturn.inspection.inspection_id;
    const damageInput = {
      inspection_id: failedId, damaged_items: ['brakes'], description: 'Phanh phát tiếng lạ khi nhận xe',
      evidence_source: 'inspection', share_with_operator: true,
    };
    assert.equal((await request('/garage/damages', driverOne, damageInput)).status, 403);
    assert.equal((await request('/garage/damages', garage, { ...damageInput, damaged_items: [] })).status, 400);
    assert.equal((await request('/garage/damages', garage, { ...damageInput, inspection_id: replacedId })).status, 409);
    const reports = await Promise.all([
      request('/garage/damages', garage, damageInput), request('/garage/damages', garage, damageInput),
    ]);
    assert.deepEqual(reports.map((response) => response.status).sort(), [201, 409]);
    const { data: damage } = await reports.find((response) => response.status === 201).json();
    const maintenance = await db.collection('maintenance_records').findOne({ vehicle_id: 7 });
    assert.equal(damage.maintenance_id, maintenance.maintenance_id);
    const maintenanceDetail = await request('/garage/tasks/maintenance-' + maintenance.maintenance_id + '/7', garage);
    assert.deepEqual((await maintenanceDetail.json()).data.damage_sources, [{ booking_id: 90, inspection_id: failedId }]);
    assert.equal(damage.photo_count, 1);
    assert.equal(damage.photos, undefined);
    const damagePhotoPath = '/garage/damages/' + failedId + '/photos/1';
    assert.equal((await request(damagePhotoPath, operator)).status, 403);
    const garageEvidence = await request(damagePhotoPath, garage);
    assert.deepEqual(Buffer.from(await garageEvidence.arrayBuffer()), png);
    const { data: dispatch } = await (await request('/operator/dispatch', operator)).json();
    const notice = dispatch.incidents.find((item) => item.incident_id === damage.incident_id);
    assert.deepEqual(notice.damage_report.damaged_items, ['brakes']);
    assert.equal(notice.damage_report.photo_count, 1);
    assert.equal(notice.workflow_stage, null);

    const incidentPath = '/operator/dispatch/90/incidents/' + damage.incident_id;
    const operatorEvidence = await request(incidentPath + '/damage-photos/1', operator);
    assert.equal(operatorEvidence.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await operatorEvidence.arrayBuffer()), png);
    assert.equal((await request('/operator/dispatch/91/incidents/' + damage.incident_id + '/damage-photos/1', operator)).status, 404);
    assert.equal((await request(incidentPath + '/resolve', operator, { resolution_note: 'Chuyển Gara kiểm tra phanh' })).status, 200);
    const { data: resolvedReturn } = await (await request(returnPath, garage)).json();
    assert.equal(resolvedReturn.damage_report.incident.incident_status, 'resolved');
    assert.equal(resolvedReturn.damage_report.incident.resolution_note, 'Chuyển Gara kiểm tra phanh');
    assert.equal((await db.collection('trip_workflows').findOne({ booking_id: 90 })).stage, 'completed');
    assert.equal((await db.collection('vehicles').findOne({ vehicle_id: 7 })).status, 'maintenance');

    const { data: { inspection: nextVehicle } } = await (await inspect(91, 6)).json();
    assert.equal((await prepare(91, 6, nextVehicle.inspection_id)).status, 201);
    assert.equal((await receive(91, driverTwo, nextVehicle.inspection_id)).status, 200);
    assert.equal((await request('/driver/workflow/91/update', driverTwo, { kind: 'picked_up' })).status, 200);
    await reportTrip(91, driverTwo);
    const passedReturnResponse = await returnCheck(91, 6);
    assert.equal(passedReturnResponse.status, 201);
    const { data: { inspection: passedReturn } } = await passedReturnResponse.json();
    assert.equal((await request('/garage/damages', garage, { ...damageInput, inspection_id: passedReturn.inspection_id })).status, 409);
    assert.equal((await db.collection('vehicles').findOne({ vehicle_id: 6 })).status, 'in_use');
    assert.equal((await confirmReturn(91, driverTwo)).status, 200);
    assert.equal((await db.collection('vehicles').findOne({ vehicle_id: 6 })).status, 'available');

    await db.collection('vehicle_inspections').insertOne({
      inspection_id: 1000, booking_id: 93, vehicle_id: 3, staff_id: 4,
      inspection_type: 'return', result: 'failed', inspected_at: new Date(), odometer: 900,
    });
    const legacyDamage = { ...damageInput, inspection_id: 1000, share_with_operator: false };
    assert.equal((await request('/garage/damages', garage, legacyDamage)).status, 400);
    const uploaded = await request('/garage/damages', garage, {
      ...legacyDamage, evidence_source: 'upload', photos: [{ content_type: 'image/png', base64: png.toString('base64') }],
    });
    assert.equal(uploaded.status, 201);
    assert.equal((await uploaded.json()).data.incident_id, null);
    const uploadedPhoto = await request('/garage/damages/1000/photos/1', garage);
    assert.deepEqual(Buffer.from(await uploadedPhoto.arrayBuffer()), png);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db.databaseName === dbName) await db.dropDatabase();
    await mongoose.disconnect();
  }
});
