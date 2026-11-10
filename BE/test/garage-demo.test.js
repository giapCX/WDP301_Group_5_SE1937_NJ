import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { once } from 'node:events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { readSeedDatasets } from '../src/database/seed.js';
import { curateGarageDemo, demoVehicleIds } from '../src/database/garage-demo.js';
import { connectTestDatabase, closeTestDatabase } from '../test-support/seeded-database.js';

let server, base;
const tokens = {
  garage: jwt.sign({ sub: '020000000000000000000010' }, env.jwtSecret),
  manager: jwt.sign({ sub: '020000000000000000000013' }, env.jwtSecret),
};
before(async () => {
  server = createApp(await connectTestDatabase()).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeTestDatabase();
});
async function request(path, method = 'GET', body, role = 'garage', status = 200) {
  const response = await fetch(base + path, {
    method, headers: { Authorization: `Bearer ${tokens[role]}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result.data;
}

test('curated seed is idempotent and all four scenarios reference the same vehicles and people', async () => {
  const datasets = await readSeedDatasets();
  const stringify = mongoose.mongo.BSON.EJSON.stringify;
  assert.equal(stringify(curateGarageDemo(mongoose.mongo.BSON.EJSON.parse(stringify(datasets)))), stringify(datasets));
  const byName = Object.fromEntries(datasets.map((set) => [set.name, set.documents]));
  assert.equal(byName.incident_cases.length, 1);
  assert.equal(byName.notifications.length, 0);
  for (const vehicleId of demoVehicleIds) {
    const vehicle = byName.vehicles.find((row) => row._id.equals(vehicleId));
    const report = byName.vehicle_inspections.find((row) => row.vehicle_id.equals(vehicleId));
    assert.ok(byName.users.some((row) => row._id.equals(vehicle.owner_id)));
    assert.equal(String(report.garage_staff_id), '020000000000000000000010');
    assert.equal(vehicle.physical_status, 'with_owner');
    assert.deepEqual(report.condition_report.photo_keys, []);
    if (report.approval_status === 'approved') {
      const agreement = byName.management_agreements.find((row) => row.vehicle_id.equals(vehicleId));
      assert.ok(agreement.owner_id.equals(vehicle.owner_id));
      assert.equal(agreement.status, 'active');
      assert.equal(agreement.commission_rate_pct, 10);
    }
  }
});

test('seeded draft submits and pending report can be approved by Manager', async () => {
  const workspace = await request('/garage/workspace');
  const draft = workspace.tasks.find((row) => String(row.vehicleId) === String(demoVehicleIds[0]) && row.kind === 'inspection');
  assert.equal(draft.status, 'draft');
  assert.equal(draft.readOnly, false);
  const submitted = await request(`/garage/inspections/${draft.recordId}/submit`, 'POST', { version: draft.version });
  assert.equal(submitted.approval_status, 'pending');
  const queue = await request('/manager/vehicles', 'GET', undefined, 'manager');
  const pending = queue.find((row) => row.id === String(demoVehicleIds[1]));
  assert.equal(pending.inspection.status, 'pending');
  await request(`/manager/vehicles/${pending.id}/review`, 'PATCH', { action: 'approve', note: 'Đã kiểm tra biên bản mẫu.', inspectionId: pending.inspection.id, inspectionVersion: pending.inspection.version }, 'manager');
});

test('revision scenario creates a new round and approved scenario can complete intake', async () => {
  const vehicleId = String(demoVehicleIds[2]);
  const draft = await request('/garage/inspections', 'POST', {
    vehicleId, odometerKm: 16000, fuelLevelPct: 70, recommendation: 'pass',
    condition: { exterior: 'good', interior: 'good', engine: 'good', tires: 'good', note: 'Đã thay lốp và kiểm tra lại góc đặt bánh.', photoKeys: [] },
  }, 'garage', 201);
  const submitted = await request(`/garage/inspections/${draft._id}/submit`, 'POST', { version: draft.version });
  await request(`/manager/vehicles/${vehicleId}/review`, 'PATCH', { action: 'approve', note: 'Đã khắc phục yêu cầu vòng trước.', inspectionId: submitted._id, inspectionVersion: submitted.version }, 'manager');
  const workspace = await request('/garage/workspace');
  const intakeTask = workspace.tasks.find((row) => String(row.vehicleId) === String(demoVehicleIds[3]) && row.kind === 'intake');
  assert.deepEqual(intakeTask.blockers, []);
  const intake = await request('/garage/intakes', 'POST', {
    vehicleId: String(demoVehicleIds[3]), managementAgreementId: intakeTask.agreementId,
    odometerKm: 18000, fuelLevelPct: 70,
    condition: { exterior: 'good', interior: 'good', engine: 'good', tires: 'good', note: '', photoKeys: [], accessories: ['vehicle_key'] },
  }, 'garage', 201);
  await request(`/garage/intakes/${intake._id}/confirm`, 'POST', { version: intake.version, ownerConfirmed: true });
  const refreshed = await request('/garage/workspace');
  assert.equal(refreshed.tasks.find((row) => row.recordId === intake._id).status, 'completed');
});
