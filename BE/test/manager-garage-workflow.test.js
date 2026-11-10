import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getModels } from '../src/models/index.js';
import { connectTestDatabase, closeTestDatabase } from '../test-support/seeded-database.js';

let connection, models, server, base, directory;
const actors = {}, tokens = {};
const condition = (photoKeys = []) => ({ exterior: 'good', interior: 'good', engine: 'good', tires: 'good', note: '', photoKeys });
async function request(path, method = 'GET', body, role = 'GARAGE_STAFF') {
  const response = await fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[role]}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
function ok(result, status = 200) { assert.equal(result.status, status, JSON.stringify(result.body)); return result.body.data; }
before(async () => {
  connection = await connectTestDatabase();
  models = getModels(connection);
  for (const code of ['MANAGER', 'GARAGE_STAFF', 'OPERATION_STAFF', 'RENTER', 'OWNER']) {
    const role = await models.Role.findOne({ code }).lean();
    actors[code] = await models.User.findOne({ primary_role_id: role._id }).lean();
    tokens[code] = jwt.sign({ sub: String(actors[code]._id) }, env.jwtSecret);
  }
  directory = await mkdtemp(join(tmpdir(), 'xedi-manager-garage-'));
  server = createApp(connection, { garageUploadDirectory: directory }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((done) => server.close(done));
  await closeTestDatabase();
  if (directory) {
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep));
    await rm(target, { recursive: true, force: true });
  }
});
async function fixture() {
  const now = Date.now();
  const vehicle = await models.Vehicle.create({ owner_id: actors.OWNER._id, license_plate: randomUUID(), brand: 'Workflow', model: 'Test', onboarding_status: 'submitted', physical_status: 'with_owner', created_at: new Date() });
  const agreement = await models.ManagementAgreement.create({ vehicle_id: vehicle._id, owner_id: actors.OWNER._id, agreement_number: randomUUID(), status: 'active', start_date: new Date(now - 86400000), end_date: new Date(now + 365 * 86400000), signature_info: { owner_signed_at: new Date(now - 86400000), platform_signed_at: new Date(now - 86400000) }, authorization_scope: { vehicle_custody: true, rental_contract_signing: true } });
  return { vehicle, agreement };
}
async function draft(vehicle, photoKeys = [], recommendation = 'pass') {
  return ok(await request('/garage/inspections', 'POST', { vehicleId: String(vehicle._id), odometerKm: 10000, fuelLevelPct: 70, condition: { ...condition(photoKeys), note: recommendation === 'pass' ? '' : 'Requires corrective inspection' }, recommendation }), 201);
}
async function submit(record) { return ok(await request(`/garage/inspections/${record._id}/submit`, 'POST', { version: record.version })); }
function decide(vehicle, record, action = 'approve', note = 'Manager reviewed report') {
  return request(`/manager/vehicles/${vehicle._id}/review`, 'PATCH', { action, note, inspectionId: record._id, inspectionVersion: record.version }, 'MANAGER');
}

test('Garage submits, Manager reads full evidence and approves, then Garage receives the vehicle', async () => {
  const { vehicle, agreement } = await fixture();
  const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZ0AAAAASUVORK5CYII=';
  const photo = ok(await request('/garage/photos', 'POST', { name: 'condition.png', contentType: 'image/png', data: image }), 201);
  const pending = await submit(await draft(vehicle, [photo.key]));
  assert.equal(pending.approval_status, 'pending');
  const queue = ok(await request('/manager/vehicles', 'GET', undefined, 'MANAGER'));
  const review = queue.find((item) => item.id === String(vehicle._id));
  assert.equal(review.inspection.id, pending._id);
  assert.equal(review.inspection.conditionReport.odometer_km, 10000);
  assert.deepEqual(review.inspection.conditionReport.photo_keys, [photo.key]);
  const url = `${base}/api/garage/photos/${photo.key.replace('garage-photos/', '')}`;
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${tokens.MANAGER}` } })).status, 200);
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${tokens.RENTER}` } })).status, 403);
  assert.equal((await request('/garage/photos', 'POST', { name: 'no.png', contentType: 'image/png', data: image }, 'MANAGER')).status, 403);
  ok(await decide(vehicle, pending));
  const approved = await models.VehicleInspection.findById(pending._id).lean();
  assert.equal(approved.approval_status, 'approved');
  assert.ok(approved.reviewed_by_manager_id.equals(actors.MANAGER._id));
  assert.equal((await models.Vehicle.findById(vehicle._id).lean()).onboarding_status, 'approved');
  assert.equal((await models.Vehicle.findById(vehicle._id).lean()).physical_status, 'with_owner');
  const intake = ok(await request('/garage/intakes', 'POST', { vehicleId: String(vehicle._id), managementAgreementId: String(agreement._id), odometerKm: 10000, fuelLevelPct: 70, condition: { ...condition(), accessories: ['vehicle_key'] } }), 201);
  ok(await request(`/garage/intakes/${intake._id}/confirm`, 'POST', { version: intake.version, ownerConfirmed: true }));
  assert.equal((await models.Vehicle.findById(vehicle._id).lean()).physical_status, 'at_garage');
});

test('Manager revision closes the old round and Garage can submit and approve a new round', async () => {
  const { vehicle } = await fixture();
  const first = await submit(await draft(vehicle));
  ok(await decide(vehicle, first, 'revision', 'Check condition again'));
  assert.equal((await models.VehicleInspection.findById(first._id).lean()).approval_status, 'revision_required');
  const second = await submit(await draft(vehicle));
  const queue = ok(await request('/manager/vehicles', 'GET', undefined, 'MANAGER'));
  assert.equal(queue.find((item) => item.id === String(vehicle._id)).inspection.id, second._id);
  assert.equal((await decide(vehicle, first)).status, 409);
  ok(await decide(vehicle, second));
  assert.equal((await models.VehicleInspection.findById(first._id).lean()).approval_status, 'revision_required');
  assert.equal((await models.VehicleInspection.findById(second._id).lean()).approval_status, 'approved');
});

test('drafts, non-passing reports and stale report versions cannot be approved', async () => {
  const { vehicle } = await fixture();
  await models.VehicleInspection.create({ vehicle_id: vehicle._id, garage_staff_id: actors.GARAGE_STAFF._id, inspection_type: 'onboarding', approval_status: 'approved', recommendation: 'pass', created_at: new Date(Date.now() - 86400000), inspected_at: new Date(Date.now() - 86400000) });
  const record = await draft(vehicle);
  assert.equal((await decide(vehicle, record)).status, 409);
  const pending = await submit(record);
  assert.equal((await decide(vehicle, record)).status, 409);
  const results = await Promise.all([decide(vehicle, pending), decide(vehicle, pending)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(await models.AuditLog.countDocuments({ action: 'vehicle.inspection.approve', entity_id: pending._id }), 1);
  const other = await fixture();
  const failed = await submit(await draft(other.vehicle, [], 'fail'));
  assert.equal((await decide(other.vehicle, failed)).status, 409);
});

test('Manager rejection concludes both records and role boundaries cannot be bypassed', async () => {
  const { vehicle } = await fixture();
  const pending = await submit(await draft(vehicle));
  const body = { action: 'reject', note: 'Vehicle rejected on evidence', inspectionId: pending._id, inspectionVersion: pending.version };
  assert.equal((await request(`/manager/vehicles/${vehicle._id}/review`, 'PATCH', body)).status, 403);
  ok(await decide(vehicle, pending, 'reject', body.note));
  assert.equal((await models.VehicleInspection.findById(pending._id).lean()).approval_status, 'rejected');
  assert.equal((await models.Vehicle.findById(vehicle._id).lean()).onboarding_status, 'rejected');
  const workspace = ok(await request('/garage/workspace'));
  assert.equal(workspace.tasks.find((task) => task.recordId === pending._id).decisionReason, body.note);
  const noReport = await fixture();
  assert.equal((await request(`/manager/vehicles/${noReport.vehicle._id}/review`, 'PATCH', { action: 'approve' }, 'MANAGER')).status, 409);
});

test('Garage sees the rejection reason for a vehicle rejected before any inspection exists', async () => {
  const { vehicle } = await fixture();
  const note = 'Vehicle papers are unreadable';
  ok(await request(`/manager/vehicles/${vehicle._id}/review`, 'PATCH', { action: 'reject', note }, 'MANAGER'));
  const workspace = ok(await request('/garage/workspace'));
  const task = workspace.tasks.find((item) => item.kind === 'inspection' && item.vehicleId === String(vehicle._id));
  assert.ok(task);
  assert.equal(task.status, 'rejected');
  assert.equal(task.readOnly, true);
  assert.equal(task.recordId, undefined);
  assert.equal(task.vehicleReviewNote, note);
  assert.equal(task.vehicleReviewStatus, 'rejected');
});

test('vehicle rejection notes remain visible without replacing a historical inspection decision', async () => {
  const { vehicle } = await fixture();
  const inspection = await models.VehicleInspection.create({ vehicle_id: vehicle._id, garage_staff_id: actors.GARAGE_STAFF._id, inspection_type: 'onboarding', approval_status: 'approved', recommendation: 'pass', version: 0, decision_reason: 'Previously approved inspection', created_at: new Date() });
  ok(await decide(vehicle, inspection, 'reject', 'Owner must correct the vehicle documents'));
  const workspace = ok(await request('/garage/workspace'));
  const task = workspace.tasks.find((item) => item.recordId === String(inspection._id));
  assert.equal(task.decisionReason, 'Previously approved inspection');
  assert.equal(task.vehicleReviewNote, 'Owner must correct the vehicle documents');
  assert.equal(task.vehicleReviewStatus, 'rejected');
});

test('audit failure rolls back the Manager decision on both inspection and vehicle', async (t) => {
  const { vehicle } = await fixture();
  const pending = await submit(await draft(vehicle));
  t.mock.method(console, 'error', () => {});
  await connection.db.command({ collMod: 'audit_logs', validator: { impossible_test_field: { $exists: true } } });
  try {
    assert.equal((await decide(vehicle, pending)).status, 500);
    assert.equal((await models.VehicleInspection.findById(pending._id).lean()).approval_status, 'pending');
    assert.equal((await models.Vehicle.findById(vehicle._id).lean()).onboarding_status, 'submitted');
  } finally { await connection.db.command({ collMod: 'audit_logs', validator: {} }); }
});

async function incidentFixture() {
  const { vehicle } = await fixture();
  await models.Vehicle.updateOne({ _id: vehicle._id }, { $set: { physical_status: 'maintenance' } });
  const booking = await models.Booking.create({ booking_code: randomUUID(), vehicle_id: vehicle._id, renter_id: actors.RENTER._id, start_at: new Date(Date.now() - 86400000), end_at: new Date(), status: 'completed' });
  const deposit = await models.SecurityDeposit.create({ booking_id: booking._id, collected_amount: 100, refundable_amount: 100, deducted_amount: 0, status: 'collected' });
  const incident = ok(await request('/garage/incidents', 'POST', { vehicleId: String(vehicle._id), bookingId: String(booking._id), description: 'New damage found at return', severity: 'medium', photoKeys: [], requestId: randomUUID() }), 201);
  return { vehicle, booking, deposit, incident };
}
function proposal(incident, role = 'OPERATION_STAFF') {
  return request(`/operations/incidents/${incident._id}/compensation-proposal`, 'POST', { amount: 80, evidenceBasis: 'Before and after photographs compared', renterResponse: 'disputed' }, role);
}
function approve(incident) { return request(`/manager/incidents/${incident._id}/compensation`, 'PATCH', { decision: 'approve', amount: 80, claimIndex: 0, note: 'Reviewed both sides and evidence' }, 'MANAGER'); }

test('Garage incident requires Operation proposal, then Manager deducts once and leaves maintenance unchanged', async () => {
  const f = await incidentFixture();
  assert.equal((await approve(f.incident)).status, 409);
  assert.equal((await proposal(f.incident, 'GARAGE_STAFF')).status, 403);
  assert.equal((await proposal(f.incident, 'MANAGER')).status, 403);
  ok(await proposal(f.incident), 201);
  assert.equal((await proposal(f.incident)).status, 409);
  const results = await Promise.all([approve(f.incident), approve(f.incident)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 404]);
  const deposit = await models.SecurityDeposit.findById(f.deposit._id).lean();
  assert.equal(deposit.deducted_amount, 80);
  assert.equal(deposit.refundable_amount, 20);
  assert.equal(deposit.deduction_decisions.length, 1);
  assert.equal((await models.IncidentCase.findById(f.incident._id).lean()).status, 'resolved');
  assert.equal((await models.Vehicle.findById(f.vehicle._id).lean()).physical_status, 'maintenance');
  const workspace = ok(await request('/garage/workspace'));
  assert.equal(workspace.incidents.find((item) => item.recordId === f.incident._id).status, 'resolved');
});

test('failed financial audit rolls back deposit and incident together', async (t) => {
  const f = await incidentFixture();
  ok(await proposal(f.incident), 201);
  t.mock.method(console, 'error', () => {});
  await connection.db.command({ collMod: 'audit_logs', validator: { impossible_test_field: { $exists: true } } });
  try {
    assert.equal((await approve(f.incident)).status, 500);
    assert.equal((await models.SecurityDeposit.findById(f.deposit._id).lean()).refundable_amount, 100);
    assert.equal((await models.IncidentCase.findById(f.incident._id).lean()).compensation_claims[0].decision, 'pending');
  } finally { await connection.db.command({ collMod: 'audit_logs', validator: {} }); }
});

test('Operation investigates an existing owner claim without duplicating it or treating silence as consent', async () => {
  const f = await incidentFixture();
  await models.IncidentCase.updateOne({ _id: f.incident._id }, { $set: { compensation_claims: [{ requested_amount: 100, decision: 'pending' }] } });
  assert.equal((await approve(f.incident)).status, 409);
  ok(await request(`/operations/incidents/${f.incident._id}/compensation-proposal`, 'POST', { amount: 80, claimIndex: 0, evidenceBasis: 'Investigated owner supplied claim and photos', renterResponse: 'not_received' }, 'OPERATION_STAFF'), 201);
  const incident = await models.IncidentCase.findById(f.incident._id).lean();
  assert.equal(incident.compensation_claims.length, 1);
  assert.equal(incident.compensation_claims[0].requested_amount, 100);
  assert.equal(incident.compensation_claims[0].proposed_amount, 80);
  assert.equal(incident.compensation_claims[0].renter_response, 'not_received');
  assert.equal((await models.SecurityDeposit.findById(f.deposit._id).lean()).refundable_amount, 100);
});

test('a multi-role employee cannot approve their own compensation proposal', async () => {
  const f = await incidentFixture();
  const manager = await models.User.findById(actors.MANAGER._id).lean();
  const operationRole = await models.Role.findOne({ code: 'OPERATION_STAFF' }).lean();
  await models.User.updateOne({ _id: manager._id }, { $set: { additional_role_ids: [...(manager.additional_role_ids || []), operationRole._id] } });
  try {
    ok(await proposal(f.incident, 'MANAGER'), 201);
    assert.equal((await approve(f.incident)).status, 409);
    assert.equal((await models.SecurityDeposit.findById(f.deposit._id).lean()).refundable_amount, 100);
    assert.equal((await models.IncidentCase.findById(f.incident._id).lean()).compensation_claims[0].decision, 'pending');
  } finally {
    await models.User.updateOne({ _id: manager._id }, { $set: { additional_role_ids: manager.additional_role_ids || [] } });
  }
});
