import { useTestDatabase } from '../test-support/mongoose.js';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { before, beforeEach, after, test } from 'node:test';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { startIntakeTestReplica } from '../test-support/intake-replica.js';

const { ObjectId } = Types;

const staffId = new ObjectId();
const secondStaffId = new ObjectId();
const roleId = new ObjectId();
const ownerId = new ObjectId();
const vehicleId = new ObjectId();
const agreementId = new ObjectId();
const token = jwt.sign({ sub: String(staffId) }, env.jwtSecret);
const fixtureNames = [
  'users',
  'roles',
  'vehicles',
  'management_agreements',
  'vehicle_inspections',
  'vehicle_intakes',
  'audit_logs',
];
let replica, db, server, baseUrl;
async function listen() {
  const instance = createApp(useTestDatabase(replica.client, db.databaseName)).listen(0, '127.0.0.1');
  await once(instance, 'listening');
  return {
    server: instance,
    url: `http://127.0.0.1:${instance.address().port}/api/garage`,
  };
}
before(async () => {
  replica = await startIntakeTestReplica();
  db = replica.client.db(
    `xedi_intake_test_${randomUUID().replaceAll('-', '')}`,
  );
  for (const name of fixtureNames) await db.createCollection(name);
  ({ server, url: baseUrl } = await listen());
});
beforeEach(async () => {
  for (const name of fixtureNames) await db.collection(name).deleteMany({});
  const now = Date.now();
  await db
    .collection('roles')
    .insertOne({
      _id: roleId,
      code: 'GARAGE_STAFF',
      permissions: ['vehicle.intake'],
    });
  await db.collection('users').insertMany([
    {
      _id: staffId,
      account_status: 'active',
      primary_role_id: roleId,
      password_hash: 'must-not-be-exposed',
    },
    { _id: secondStaffId, account_status: 'active', primary_role_id: roleId },
  ]);
  await db
    .collection('vehicles')
    .insertOne({
      _id: vehicleId,
      owner_id: ownerId,
      brand: 'Toyota',
      model: 'Vios',
      license_plate: 'TEST-001',
      onboarding_status: 'approved',
      physical_status: 'with_owner',
      vin: 'private-vin',
      documents: ['private-document'],
    });
  await db
    .collection('management_agreements')
    .insertOne({
      _id: agreementId,
      vehicle_id: vehicleId,
      owner_id: ownerId,
      agreement_number: 'TEST-MGMT-001',
      status: 'active',
      start_date: new Date(now - 86400000),
      end_date: new Date(now + 86400000 * 30),
      created_at: new Date(now - 86400000 * 2),
      signature_info: {
        owner_signed_at: new Date(now - 86400000),
        platform_signed_at: new Date(now - 86400000),
      },
      authorization_scope: { vehicle_custody: true },
    });
  await db
    .collection('vehicle_inspections')
    .insertOne({
      _id: new ObjectId(),
      vehicle_id: vehicleId,
      inspection_type: 'onboarding',
      approval_status: 'approved',
      recommendation: 'pass',
      inspected_at: new Date(now - 10000),
      condition_report: { odometer_km: 10000 },
    });
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try {
    if (db) await db.dropDatabase();
  } finally {
    if (replica) await replica.close();
  }
});
async function request(path = '', method = 'GET', body, options = {}) {
  const response = await fetch(`${options.url || baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: options.authorization ?? `Bearer ${token}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
const fullDraft = () => ({
  vehicleId: String(vehicleId),
  managementAgreementId: String(agreementId),
  odometerKm: 10050,
  fuelLevelPct: 70,
  condition: {
    exterior: 'good',
    interior: 'good',
    engine: 'good',
    tires: 'good',
    note: 'Đã kiểm tra tại gara.',
    accessories: ['vehicle_key', 'registration_copy'],
    photoKeys: ['intakes/test/front.jpg'],
  },
});
async function createDraft(body = fullDraft()) {
  const result = await request('/intakes', 'POST', body);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.data;
}
async function confirm(id, version = 0) {
  return request(`/intakes/${id}/confirm`, 'POST', {
    version,
    ownerConfirmed: true,
  });
}

test('garage routes fail closed, reject invalid credentials and check active permission', async () => {
  assert.equal(
    (await request('/intakes', 'GET', undefined, { authorization: '' })).status,
    401,
  );
  await db
    .collection('users')
    .updateOne({ _id: staffId }, { $set: { account_status: 'suspended' } });
  assert.equal((await request('/intakes')).status, 401);
  await db
    .collection('users')
    .updateOne({ _id: staffId }, { $set: { account_status: 'active' } });
  await db
    .collection('roles')
    .updateOne({ _id: roleId }, { $set: { permissions: [] } });
  assert.equal((await request('/intakes')).status, 403);
});
test('login JWT identifies the employee who creates a garage receipt', async () => {
  await db.collection('users').updateOne({ _id: staffId }, { $set: {
    email: 'garage-auth-test@example.com',
    full_name: 'Garage auth test',
    password_hash: await bcrypt.hash('garage-test-password', 4),
  } });
  const response = await fetch(new URL('/api/auth/login', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'garage-auth-test@example.com', password: 'garage-test-password' }),
  });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.user._id, String(staffId));
  assert.ok(data.user.permissions.includes('vehicle.intake'));
  const result = await request('/intakes', 'POST', fullDraft(), {
    authorization: `Bearer ${data.token}`,
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.data.created_by_garage_staff_id, String(staffId));
});

test('garage rejects invalid or expired JWTs and users removed after login', async () => {
  for (const authorization of [
    'Bearer old-static-garage-token',
    `Bearer ${jwt.sign({ sub: String(staffId) }, 'different-secret')}`,
    `Bearer ${jwt.sign({ sub: String(staffId), exp: 1 }, env.jwtSecret)}`,
  ]) {
    assert.equal((await request('/intakes', 'GET', undefined, { authorization })).status, 401);
  }
  await db.collection('users').deleteOne({ _id: staffId });
  assert.equal((await request('/intakes')).status, 401);
});

test('garage uses current additional roles and ignores stale permission claims in JWT', async () => {
  const authorization = `Bearer ${jwt.sign({
    sub: String(staffId), permissions: ['vehicle.intake'], role: 'GARAGE_STAFF',
  }, env.jwtSecret)}`;
  await db.collection('users').updateOne({ _id: staffId }, { $set: {
    primary_role_id: new ObjectId(), additional_role_ids: [roleId],
  } });
  assert.equal((await request('/intakes', 'GET', undefined, { authorization })).status, 200);
  await db.collection('roles').updateOne({ _id: roleId }, { $set: { permissions: [] } });
  assert.equal((await request('/intakes', 'GET', undefined, { authorization })).status, 403);
});
test('lists candidates with eligibility and omits private vehicle/user fields', async () => {
  const result = await request('/intake-vehicles?q=Toyota&limit=1');
  assert.equal(result.status, 200);
  assert.equal(result.body.pagination.total, 1);
  assert.equal(result.body.data[0].eligible, true);
  assert.equal(result.body.data[0].baselineOdometerKm, 10000);
  assert.equal(result.body.data[0].vehicle.vin, undefined);
  assert.equal(result.body.data[0].vehicle.documents, undefined);
  assert.equal(
    (await request('/intake-vehicles?q=.*')).body.pagination.total,
    0,
  );
});
test('draft saves partial conditions with optimistic concurrency and blocks spoofed fields', async () => {
  const draft = await createDraft({
    vehicleId: String(vehicleId),
    managementAgreementId: String(agreementId),
  });
  assert.equal(draft.status, 'draft');
  assert.equal(draft.version, 0);
  assert.equal(draft.created_by_garage_staff_id, String(staffId));
  const patch = await request(`/intakes/${draft._id}`, 'PATCH', {
    version: 0,
    odometerKm: 10020,
    condition: { exterior: 'good' },
  });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.data.version, 1);
  assert.equal(
    (
      await request(`/intakes/${draft._id}`, 'PATCH', {
        version: 0,
        fuelLevelPct: 40,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/intakes/${draft._id}`, 'PATCH', {
        version: 1,
        received_by_garage_staff_id: String(secondStaffId),
      })
    ).status,
    400,
  );
  assert.equal((await createDraftConflict()).status, 409);
  assert.equal(
    (await db.collection('vehicles').findOne({ _id: vehicleId }))
      .physical_status,
    'with_owner',
  );
});
async function createDraftConflict() {
  return request('/intakes', 'POST', fullDraft());
}
test('confirms atomically, records actor/audit and replays identical confirmation safely', async () => {
  const draft = await createDraft();
  const result = await confirm(draft._id);
  assert.equal(result.status, 200);
  assert.equal(result.body.replayed, false);
  assert.equal(result.body.data.status, 'completed');
  assert.equal(result.body.data.version, 1);
  assert.equal(result.body.data.received_by_garage_staff_id, String(staffId));
  assert.equal(
    result.body.data.condition_snapshot.owner_signature_recorded,
    true,
  );
  assert.ok(new Date(result.body.data.received_at).getTime());
  assert.equal(
    (await db.collection('vehicles').findOne({ _id: vehicleId }))
      .physical_status,
    'at_garage',
  );
  const replay = await confirm(draft._id);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(await db.collection('audit_logs').countDocuments(), 1);
  assert.equal(
    (
      await request(`/intakes/${draft._id}`, 'PATCH', {
        version: 1,
        fuelLevelPct: 20,
      })
    ).status,
    409,
  );
  const list = await request('/intakes?status=completed&q=Vios');
  assert.equal(list.body.pagination.total, 1);
});
test('concurrent confirmations create only one receipt and one audit entry', async () => {
  const draft = await createDraft();
  const results = await Promise.all([confirm(draft._id), confirm(draft._id)]);
  assert.ok(
    results.every((result) => result.status === 200),
    JSON.stringify(results),
  );
  assert.equal(results.filter((result) => !result.body.replayed).length, 1);
  assert.equal(await db.collection('audit_logs').countDocuments(), 1);
  assert.equal(await db.collection('vehicle_intakes').countDocuments(), 1);
});
test('rechecks approval, latest inspection, contract signatures/term/custody and current vehicle state', async () => {
  const draft = await createDraft();
  for (const [collection, filter, changes, code] of [
    [
      'vehicles',
      { _id: vehicleId },
      { onboarding_status: 'submitted' },
      'VEHICLE_NOT_APPROVED',
    ],
    [
      'vehicles',
      { _id: vehicleId },
      { physical_status: 'rented' },
      'INVALID_PHYSICAL_STATUS',
    ],
    [
      'management_agreements',
      { _id: agreementId },
      { status: 'terminated' },
      'AGREEMENT_NOT_ACTIVE',
    ],
    [
      'management_agreements',
      { _id: agreementId },
      { end_date: new Date(Date.now() - 1000) },
      'AGREEMENT_OUTSIDE_TERM',
    ],
    [
      'management_agreements',
      { _id: agreementId },
      { 'signature_info.owner_signed_at': null },
      'AGREEMENT_NOT_SIGNED',
    ],
    [
      'management_agreements',
      { _id: agreementId },
      { 'authorization_scope.vehicle_custody': false },
      'CUSTODY_NOT_AUTHORIZED',
    ],
  ]) {
    const original = await db.collection(collection).findOne(filter);
    await db.collection(collection).updateOne(filter, { $set: changes });
    const result = await confirm(draft._id);
    assert.equal(result.status, 409, code);
    assert.ok(
      result.body.error.details.blockers.some((item) => item.code === code),
    );
    await db.collection(collection).replaceOne(filter, original);
  }
  await db
    .collection('vehicle_inspections')
    .insertOne({
      vehicle_id: vehicleId,
      inspection_type: 'onboarding',
      approval_status: 'rejected',
      recommendation: 'reject',
      inspected_at: new Date(),
      condition_report: { odometer_km: 10000 },
    });
  assert.equal((await confirm(draft._id)).status, 409);
  assert.equal(await db.collection('audit_logs').countDocuments(), 0);
});
test('rejects invalid meter/fuel/report/confirmation and unrelated agreements', async () => {
  assert.equal(
    (await request('/intakes', 'POST', { ...fullDraft(), fuelLevelPct: 101 }))
      .status,
    400,
  );
  assert.equal(
    (await request('/intakes', 'POST', { ...fullDraft(), odometerKm: '10050' }))
      .status,
    400,
  );
  const draft = await createDraft({ ...fullDraft(), odometerKm: 9999 });
  assert.equal((await confirm(draft._id)).status, 400);
  assert.equal(
    (
      await request(`/intakes/${draft._id}/confirm`, 'POST', {
        version: 0,
        ownerConfirmed: false,
      })
    ).status,
    400,
  );
  assert.equal((await request('/intakes/invalid')).status, 400);
  assert.equal((await request(`/intakes/${new ObjectId()}`)).status, 404);
  assert.equal((await request('/intakes?page=0')).status, 400);
  assert.equal((await request('/intakes?q=a&q=b')).status, 400);
  await db
    .collection('management_agreements')
    .updateOne({ _id: agreementId }, { $set: { owner_id: new ObjectId() } });
  assert.equal(
    (
      await request(
        `/vehicles/${vehicleId}/intake-eligibility?managementAgreementId=${agreementId}`,
      )
    ).status,
    409,
  );
});
test('another garage staff member cannot alter or confirm the creator receipt', async () => {
  const draft = await createDraft();
  const otherAuthorization = `Bearer ${jwt.sign({ sub: String(secondStaffId) }, env.jwtSecret)}`;
  assert.equal(
    (
      await request(
        `/intakes/${draft._id}`,
        'PATCH',
        { version: 0, fuelLevelPct: 30 },
        { authorization: otherAuthorization },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/intakes/${draft._id}/confirm`,
        'POST',
        { version: 0, ownerConfirmed: true },
        { authorization: otherAuthorization },
      )
    ).status,
    403,
  );
});
test('transaction rolls back vehicle and receipt if audit insertion fails', async (t) => {
  t.mock.method(console, 'error', () => {});
  const draft = await createDraft();
  await db.command({
    collMod: 'audit_logs',
    validator: { intake_test_required: { $exists: true } },
  });
  try {
    assert.equal((await confirm(draft._id)).status, 500);
    assert.equal(
      (await db.collection('vehicles').findOne({ _id: vehicleId }))
        .physical_status,
      'with_owner',
    );
    assert.equal(
      (
        await db
          .collection('vehicle_intakes')
          .findOne({ _id: new ObjectId(draft._id) })
      ).status,
      'draft',
    );
    assert.equal(await db.collection('audit_logs').countDocuments(), 0);
  } finally {
    await db.command({ collMod: 'audit_logs', validator: {} });
  }
});
test('legacy seeded receipts are completed and immutable', async () => {
  await db
    .collection('vehicle_intakes')
    .insertOne({
      vehicle_id: vehicleId,
      management_agreement_id: agreementId,
      received_by_garage_staff_id: staffId,
      received_at: new Date(),
      odometer_km: 10020,
    });
  const result = await request('/intakes?status=completed');
  assert.equal(result.body.pagination.total, 1);
  assert.equal(result.body.data[0].status, 'completed');
  assert.equal(
    (
      await request(`/intakes/${result.body.data[0]._id}`, 'PATCH', {
        version: 0,
        fuelLevelPct: 10,
      })
    ).status,
    409,
  );
});
