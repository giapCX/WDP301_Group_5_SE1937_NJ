import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getModels } from '../src/models/index.js';
import { connectTestDatabase, closeTestDatabase } from '../test-support/seeded-database.js';

let connection, models, server, base, staff, other, token, otherToken, uploadDirectory;
const condition = () => ({ exterior: 'good', interior: 'good', engine: 'good', tires: 'good', note: '', photoKeys: [] });
async function request(path, method = 'GET', body, authorization = token) {
  const response = await fetch(`${base}/api/garage${path}`, { method, headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  connection = await connectTestDatabase();
  models = getModels(connection);
  staff = await models.User.findOne({ email: 'garage15@example.com' }).lean();
  other = await models.User.findOne({ email: 'garage16@example.com' }).lean();
  token = jwt.sign({ sub: String(staff._id) }, env.jwtSecret);
  otherToken = jwt.sign({ sub: String(other._id) }, env.jwtSecret);
  uploadDirectory = await mkdtemp(join(tmpdir(), 'xedi-photos-test-'));
  server = createApp(connection, { garageUploadDirectory: uploadDirectory }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((done) => server.close(done));
  await closeTestDatabase();
  if (uploadDirectory) {
    const target = resolve(uploadDirectory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('xedi-photos-test-'));
    await rm(target, { recursive: true, force: true });
  }
});
async function fixture() {
  const now = Date.now();
  const renter = await models.User.create({ email: `${randomUUID()}@example.com`, full_name: 'Verified renter', account_status: 'active', identity_kyc: { status: 'verified' }, driver_license: { verification_status: 'verified', expires_at: new Date(now + 86400000 * 365) } });
  const vehicle = await models.Vehicle.create({ owner_id: renter._id, license_plate: randomUUID(), brand: 'Test', model: 'Garage', onboarding_status: 'approved', physical_status: 'at_garage', vin: 'PRIVATE-VIN' });
  const management = await models.ManagementAgreement.create({ vehicle_id: vehicle._id, owner_id: renter._id, agreement_number: randomUUID(), status: 'active', start_date: new Date(now - 86400000), end_date: new Date(now + 86400000 * 30), signature_info: { owner_signed_at: new Date(now), platform_signed_at: new Date(now) }, authorization_scope: { vehicle_custody: true, rental_contract_signing: true } });
  const booking = await models.Booking.create({ booking_code: randomUUID(), renter_id: renter._id, vehicle_id: vehicle._id, management_agreement_id: management._id, start_at: new Date(now + 3600000), end_at: new Date(now + 86400000), status: 'confirmed', rental_fee_amount: 1000, deposit_amount_snapshot: 500 });
  await models.RentalAgreement.create({ booking_id: booking._id, management_agreement_id: management._id, contract_number: randomUUID(), status: 'signed', signed_at: new Date(now), signing_info: { renter_confirmed: true, platform_signer_user_id: staff._id } });
  await models.VehicleIntake.create({ vehicle_id: vehicle._id, management_agreement_id: management._id, status: 'completed', odometer_km: 10000, fuel_level_pct: 80 });
  await models.PaymentTransaction.create([
    { booking_id: booking._id, transaction_type: 'rental_payment', direction: 'in', amount: 1000, status: 'succeeded', idempotency_key: randomUUID() },
    { booking_id: booking._id, transaction_type: 'deposit_collection', direction: 'in', amount: 500, status: 'succeeded', idempotency_key: randomUUID() },
  ]);
  await models.SecurityDeposit.create({ booking_id: booking._id, required_amount: 500, collected_amount: 500, refunded_amount: 0, deducted_amount: 0, status: 'collected' });
  return { renter, vehicle, booking, management };
}
async function draft(booking, type = 'pickup', overrides = {}) {
  const response = await request('/handovers', 'POST', { bookingId: String(booking._id), type, odometerKm: 10020, fuelLevelPct: 80, condition: condition(), ...overrides });
  assert.equal(response.status, 201, JSON.stringify(response));
  return response.body.data;
}
const confirm = (record, authorization = token) => request(`/handovers/${record._id}/confirm`, 'POST', { version: record.version, renterConfirmed: true }, authorization);

test('workspace exposes live records with permissions and omits private vehicle/user information', async () => {
  await fixture();
  assert.equal((await request('/workspace', 'GET', undefined, null)).status, 401);
  const result = await request('/workspace');
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.ok(result.body.data.tasks.some((task) => task.kind === 'inspection'));
  assert.ok(result.body.data.permissions.includes('handover.record'));
  assert.equal(JSON.stringify(result.body).includes('password_hash'), false);
  assert.equal(JSON.stringify(result.body).includes('PRIVATE-VIN'), false);
  const restrictedRole = await models.Role.create({ code: randomUUID(), permissions: ['vehicle.inspect'] });
  const restricted = await models.User.create({ email: `${randomUUID()}@example.com`, account_status: 'active', primary_role_id: restrictedRole._id });
  const restrictedToken = jwt.sign({ sub: String(restricted._id), permissions: ['handover.record', 'case.report'] }, env.jwtSecret);
  const restrictedResult = await request('/workspace', 'GET', undefined, restrictedToken);
  assert.equal(restrictedResult.status, 200);
  assert.ok(restrictedResult.body.data.tasks.every((task) => task.kind === 'inspection'));
  assert.deepEqual(restrictedResult.body.data.vehicles, []);
  assert.equal((await request('/incidents', 'POST', {}, restrictedToken)).status, 403);
});

test('handover validates prerequisites, owns drafts, rejects stale versions and server-controlled fields', async () => {
  const f = await fixture();
  const record = await draft(f.booking);
  assert.equal(record.garage_staff_id, String(staff._id));
  assert.equal((await confirm(record, otherToken)).status, 403);
  assert.equal((await request('/handovers', 'POST', { bookingId: String(f.booking._id), type: 'pickup', garage_staff_id: String(other._id) })).status, 400);
  const updated = await request(`/handovers/${record._id}`, 'PATCH', { version: 0, fuelLevelPct: 75 });
  assert.equal(updated.status, 200);
  assert.equal((await confirm(record)).status, 409);
  assert.equal((await request(`/handovers/${record._id}/confirm`, 'POST', { version: 1, renterConfirmed: false })).status, 400);
  assert.equal((await request(`/handovers/${record._id}`, 'PATCH', { version: 1, odometerKm: -1 })).status, 400);
  assert.equal((await request('/handovers', 'POST', { bookingId: String(f.booking._id), type: 'pickup' })).status, 409);
});

test('pickup rechecks payment, deposit, signed agreement and active account at confirmation time', async () => {
  const f = await fixture();
  const record = await draft(f.booking);
  await models.SecurityDeposit.updateOne({ booking_id: f.booking._id }, { $set: { status: 'unpaid' } });
  let result = await confirm(record);
  assert.equal(result.status, 409);
  assert.ok(result.body.error.details.blockers.some((item) => item.code === 'DEPOSIT_UNPAID'));
  await models.SecurityDeposit.updateOne({ booking_id: f.booking._id }, { $set: { status: 'collected' } });
  await models.PaymentTransaction.updateMany({ booking_id: f.booking._id, transaction_type: 'rental_payment' }, { $set: { status: 'failed' } });
  result = await confirm(record);
  assert.ok(result.body.error.details.blockers.some((item) => item.code === 'RENTAL_UNPAID'));
  await models.PaymentTransaction.updateMany({ booking_id: f.booking._id }, { $set: { status: 'succeeded' } });
  await models.RentalAgreement.updateOne({ booking_id: f.booking._id }, { $set: { status: 'draft' } });
  result = await confirm(record);
  assert.ok(result.body.error.details.blockers.some((item) => item.code === 'RENTAL_NOT_SIGNED'));
  await models.RentalAgreement.updateOne({ booking_id: f.booking._id }, { $set: { status: 'signed' } });
  await models.User.updateOne({ _id: f.renter._id }, { $set: { account_status: 'suspended' } });
  result = await confirm(record);
  assert.ok(result.body.error.details.blockers.some((item) => item.code === 'RENTER_INACTIVE'));
  assert.equal((await models.Booking.findById(f.booking._id).lean()).status, 'confirmed');
});

test('concurrent pickup confirmation commits booking, vehicle and audit once and replays safely', async () => {
  const f = await fixture();
  const record = await draft(f.booking);
  const results = await Promise.all([confirm(record), confirm(record)]);
  assert.ok(results.every((item) => item.status === 200), JSON.stringify(results));
  assert.equal(results.filter((item) => item.body.replayed).length, 1);
  assert.equal((await models.Vehicle.findById(f.vehicle._id).lean()).physical_status, 'rented');
  assert.equal((await models.Booking.findById(f.booking._id).lean()).status, 'ongoing');
  assert.equal(await models.AuditLog.countDocuments({ entity_id: record._id, action: 'garage.pickup.confirmed' }), 1);
  assert.equal((await request(`/handovers/${record._id}`, 'PATCH', { version: 1, fuelLevelPct: 10 })).status, 409);
});

test('return compares pickup baseline, creates one incident for new damage and keeps financial decisions untouched', async () => {
  const f = await fixture();
  const photo = 'garage-photos/staff/test.jpg';
  const scratch = { code: 'old-scratch', location: 'Cửa trái', description: 'Xước cũ', severity: 'damaged', photo_key: photo };
  const dent = { code: 'new-dent', location: 'Cản sau', description: 'Móp mới', severity: 'damaged', photo_key: photo };
  const pickup = await draft(f.booking, 'pickup', { condition: { ...condition(), exterior: 'damaged', note: 'Có xước cũ', photoKeys: [photo], defects: [scratch] } });
  assert.equal((await confirm(pickup)).status, 200);
  const returning = await draft(f.booking, 'return', { odometerKm: 10500, fuelLevelPct: 70, condition: { ...condition(), exterior: 'damaged', note: 'Có vết móp mới', photoKeys: [photo], defects: [scratch, dent] } });
  const result = await confirm(returning);
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal((await confirm(returning)).body.replayed, true);
  assert.equal(result.body.data.baseline_handover_id, pickup._id);
  assert.deepEqual(result.body.data.damage_changes, [{ code: 'old-scratch', change: 'unchanged' }, { code: 'new-dent', change: 'new' }]);
  assert.equal((await models.Booking.findById(f.booking._id).lean()).status, 'completed');
  assert.equal((await models.Vehicle.findById(f.vehicle._id).lean()).physical_status, 'maintenance');
  const cases = await models.IncidentCase.find({ source_handover_id: returning._id }).lean();
  assert.equal(cases.length, 1);
  assert.equal(cases[0].status, 'reported');
  assert.equal(cases[0].resolution, undefined);
  assert.equal(cases[0].compensation_claims, undefined);
  assert.equal((await models.SecurityDeposit.findOne({ booking_id: f.booking._id }).lean()).refunded_amount, 0);
  const workspace = await request('/workspace');
  assert.ok(workspace.body.data.incidents.some((item) => item.recordId === String(cases[0]._id)));
  assert.ok(workspace.body.data.history.some((item) => item.title.includes('nhận trả')));
});

test('return refuses a decreasing odometer and does not report pre-existing unchanged damage', async () => {
  const f = await fixture();
  const pickup = await draft(f.booking, 'pickup', { condition: { ...condition(), exterior: 'attention', note: 'Pre-existing small scratch' } });
  assert.equal((await confirm(pickup)).status, 200);
  const returning = await draft(f.booking, 'return', { odometerKm: 10000, condition: { ...condition(), exterior: 'attention', note: 'Same small scratch' } });
  assert.equal((await confirm(returning)).status, 400);
  const update = await request(`/handovers/${returning._id}`, 'PATCH', { version: 0, odometerKm: 10100 });
  assert.equal((await confirm(update.body.data)).status, 200);
  assert.equal(await models.IncidentCase.countDocuments({ source_handover_id: returning._id }), 0);
  assert.equal((await models.Vehicle.findById(f.vehicle._id).lean()).physical_status, 'at_garage');
});

test('return records actual time and an incident when the renter has not agreed', async () => {
  const { booking } = await fixture();
  assert.equal((await confirm(await draft(booking))).status, 200);
  const returning = await draft(booking, 'return', { condition: { ...condition(), photoKeys: ['garage-photos/staff/return.jpg'] } });
  const occurredAt = new Date().toISOString();
  const result = await request(`/handovers/${returning._id}/confirm`, 'POST', {
    version: returning.version, renterConfirmed: false, disputeNote: 'Khách không đồng ý hiện trạng.', occurredAt,
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.body.data.renter_confirmed_at, undefined);
  assert.equal(result.body.data.renter_response, 'not_confirmed');
  assert.equal(result.body.data.occurred_at, occurredAt);
  assert.equal((await models.Booking.findById(booking._id).lean()).status, 'completed');
  assert.equal((await models.IncidentCase.findOne({ source_handover_id: returning._id }).lean()).case_type, 'dispute');
});

test('owner return uses the intake baseline and preserves a dispute after verified receipt', async () => {
  const { renter, vehicle, booking, management } = await fixture();
  const role = await models.Role.findOne({ code: 'OWNER' }).lean();
  await models.User.updateOne({ _id: renter._id }, { $set: { primary_role_id: role._id } });
  await models.ManagementAgreement.updateOne({ _id: management._id }, { $set: { status: 'termination_requested' } });
  const withdrawal = await models.VehicleWithdrawalRequest.create({
    owner_id: renter._id, vehicle_id: vehicle._id, management_agreement_id: management._id,
    request_type: 'owner_withdrawal', status: 'requested',
  });
  const payload = { version: 0, odometerKm: 10020, fuelLevelPct: 80, occurredAt: new Date().toISOString(),
    condition: { ...condition(), photoKeys: ['garage-photos/staff/owner-return.jpg'] } };
  assert.equal((await request(`/owner-returns/${withdrawal._id}`, 'PATCH', payload)).status, 409);
  await models.Booking.updateOne({ _id: booking._id }, { $set: { status: 'completed' } });
  const saved = await request(`/owner-returns/${withdrawal._id}`, 'PATCH', payload);
  assert.equal(saved.status, 200, JSON.stringify(saved));
  assert.ok(saved.body.data.owner_return_handover.intake_id);
  assert.equal((await models.Vehicle.findById(vehicle._id).lean()).physical_status, 'at_garage');
  const ownerToken = jwt.sign({ sub: String(renter._id) }, env.jwtSecret);
  const response = await fetch(`${base}/api/owner/vehicle-withdrawals/${withdrawal._id}/handover`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ received: true, status: 'disputed', note: 'Chủ xe có bất đồng về hiện trạng.', version: 1 }),
  });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal((await models.Vehicle.findById(vehicle._id).lean()).physical_status, 'returned_to_owner');
  assert.equal((await models.IncidentCase.findOne({ source_withdrawal_id: withdrawal._id }).lean()).status, 'reported');
});

test('audit failure rolls back confirmed handover, booking and vehicle changes', async (t) => {
  const f = await fixture();
  const record = await draft(f.booking);
  t.mock.method(console, 'error', () => {});
  await connection.db.command({ collMod: 'audit_logs', validator: { impossible_test_field: { $exists: true } } });
  try {
    assert.equal((await confirm(record)).status, 500);
    assert.equal((await models.Booking.findById(f.booking._id).lean()).status, 'confirmed');
    assert.equal((await models.Vehicle.findById(f.vehicle._id).lean()).physical_status, 'at_garage');
    assert.equal((await models.RentalHandover.findById(record._id).lean()).status, 'draft');
  } finally { await connection.db.command({ collMod: 'audit_logs', validator: {} }); }
});

test('incident reporting is idempotent and prevents actor/status spoofing and unrelated bookings', async () => {
  const f = await fixture();
  const body = { vehicleId: String(f.vehicle._id), bookingId: String(f.booking._id), description: 'Incident observed at garage', severity: 'high', photoKeys: [], requestId: randomUUID() };
  const results = await Promise.all([request('/incidents', 'POST', body), request('/incidents', 'POST', body)]);
  assert.ok(results.every((item) => item.status === 201), JSON.stringify(results));
  assert.equal(results[0].body.data._id, results[1].body.data._id);
  assert.equal(await models.IncidentCase.countDocuments({ request_key: body.requestId }), 1);
  assert.equal((await request('/incidents', 'POST', { ...body, severity: 'low' })).status, 409);
  assert.equal((await request('/incidents', 'POST', { ...body, requestId: randomUUID(), status: 'resolved' })).status, 400);
  assert.equal((await request('/incidents', 'POST', { ...body, requestId: randomUUID(), bookingId: String(new Types.ObjectId()) })).status, 409);
  const id = results[0].body.data._id;
  assert.equal((await request(`/incidents/${id}`, 'GET', undefined, otherToken)).status, 404);
});

test('photo uploads verify content, stay private and reject traversal and oversized files', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZ0AAAAASUVORK5CYII=';
  const result = await request('/photos', 'POST', { name: 'car.png', contentType: 'image/png', data: png });
  assert.equal(result.status, 201, JSON.stringify(result));
  const url = `${base}/api/garage/photos/${result.body.data.key.replace('garage-photos/', '')}`;
  assert.equal((await fetch(url)).status, 401);
  const image = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.ok(Buffer.from(await image.arrayBuffer()).equals(Buffer.from(png, 'base64')));
  assert.equal((await request('/photos', 'POST', { name: 'fake.png', contentType: 'image/png', data: Buffer.from('<svg>bad</svg>').toString('base64') })).status, 400);
  assert.equal((await request('/photos', 'POST', { name: 'large.png', contentType: 'image/png', data: Buffer.alloc(513000).toString('base64') })).status, 400);
  const path = `/photos/${staff._id}/..%2Fsecret.png`;
  assert.equal((await request(path)).status, 400);
});

test('return incident and all related state changes roll back together on audit failure', async (t) => {
  const f = await fixture();
  assert.equal((await confirm(await draft(f.booking))).status, 200);
  const record = await draft(f.booking, 'return', { condition: { ...condition(), exterior: 'damaged', note: 'New damage during rental' } });
  t.mock.method(console, 'error', () => {});
  await connection.db.command({ collMod: 'audit_logs', validator: { impossible_test_field: { $exists: true } } });
  try {
    assert.equal((await confirm(record)).status, 500);
    assert.equal((await models.Booking.findById(f.booking._id).lean()).status, 'ongoing');
    assert.equal((await models.Vehicle.findById(f.vehicle._id).lean()).physical_status, 'rented');
    assert.equal((await models.RentalHandover.findById(record._id).lean()).status, 'draft');
    assert.equal(await models.IncidentCase.countDocuments({ source_handover_id: record._id }), 0);
  } finally { await connection.db.command({ collMod: 'audit_logs', validator: {} }); }
});

test('legacy incomplete payment or deposit amounts cannot bypass pickup prerequisites', async () => {
  const f = await fixture();
  const record = await draft(f.booking);
  await models.PaymentTransaction.collection.updateOne({ booking_id: f.booking._id, transaction_type: 'rental_payment' }, { $unset: { amount: '' } });
  let result = await confirm(record);
  assert.equal(result.status, 409);
  assert.ok(result.body.error.details.blockers.some((item) => item.code === 'RENTAL_UNPAID'));
  await models.PaymentTransaction.updateOne({ booking_id: f.booking._id, transaction_type: 'rental_payment' }, { $set: { amount: 1000 } });
  await models.SecurityDeposit.updateOne({ booking_id: f.booking._id }, { $unset: { collected_amount: '' } });
  result = await confirm(record);
  assert.equal(result.status, 409);
  assert.ok(result.body.error.details.blockers.some((item) => item.code === 'DEPOSIT_UNPAID'));
});
