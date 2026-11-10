import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { before, beforeEach, after, test } from 'node:test';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { startIntakeTestReplica } from '../test-support/intake-replica.js';

const token = randomBytes(32).toString('hex');
const actorId = new ObjectId(),
  otherActorId = new ObjectId(),
  ownerId = new ObjectId(),
  roleId = new ObjectId(),
  vehicleId = new ObjectId();
const auth = { token, userId: String(actorId), production: false };
let replica, db, server, baseUrl;
async function listen(config = auth) {
  const server = createApp(db, { garageAuth: config }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}/api/garage`,
  };
}
before(async () => {
  replica = await startIntakeTestReplica();
  db = replica.client.db(
    `xedi_inspection_test_${randomUUID().replaceAll('-', '')}`,
  );
  for (const name of [
    'users',
    'roles',
    'vehicles',
    'vehicle_inspections',
    'vehicle_intakes',
    'audit_logs',
  ])
    await db.createCollection(name);
  ({ server, url: baseUrl } = await listen());
});
beforeEach(async () => {
  for (const name of [
    'users',
    'roles',
    'vehicles',
    'vehicle_inspections',
    'vehicle_intakes',
    'audit_logs',
  ])
    await db.collection(name).deleteMany({});
  await db
    .collection('roles')
    .insertOne({
      _id: roleId,
      code: 'INSPECTOR',
      permissions: ['vehicle.inspect'],
    });
  await db.collection('users').insertMany([
    {
      _id: actorId,
      full_name: 'Inspector A',
      account_status: 'active',
      primary_role_id: roleId,
    },
    {
      _id: otherActorId,
      full_name: 'Inspector B',
      account_status: 'active',
      primary_role_id: roleId,
    },
    {
      _id: ownerId,
      full_name: 'Test Owner',
      password_hash: 'private-password',
      payout_profile: { account: 'private-bank' },
    },
  ]);
  await db
    .collection('vehicles')
    .insertOne({
      _id: vehicleId,
      owner_id: ownerId,
      brand: 'Toyota',
      model: 'Vios',
      license_plate: 'TEST-001',
      manufacture_year: 2024,
      onboarding_status: 'submitted',
      physical_status: 'with_owner',
      documents: ['private'],
      vin: 'private-vin',
    });
  await db
    .collection('vehicle_inspections')
    .insertOne({
      vehicle_id: vehicleId,
      garage_staff_id: actorId,
      inspection_type: 'onboarding',
      approval_status: 'revision_required',
      recommendation: 'requires_repair',
      condition_report: { odometer_km: 10000 },
      inspected_at: new Date(Date.now() - 86400000),
      created_at: new Date(Date.now() - 86400000),
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
async function request(path, method = 'GET', body, options = {}) {
  const response = await fetch(`${options.url || baseUrl}${path}`, {
    method,
    headers: {
      Authorization: options.authorization ?? `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
const fullDraft = () => ({
  vehicleId: String(vehicleId),
  odometerKm: 10025,
  fuelLevelPct: 70,
  condition: {
    exterior: 'good',
    interior: 'good',
    engine: 'good',
    tires: 'good',
    note: '',
    photoKeys: ['inspections/test/front.jpg'],
  },
  recommendation: 'pass',
});
async function create(body = fullDraft()) {
  const result = await request('/inspections', 'POST', body);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body.data;
}
const submit = (id, version = 0) =>
  request(`/inspections/${id}/submit`, 'POST', { version });

test('inspection permissions are independent of intake and credentials fail closed', async () => {
  assert.equal((await request('/inspections')).status, 200);
  assert.equal((await request('/intakes')).status, 403);
  assert.equal(
    (await request('/inspections', 'GET', undefined, { authorization: '' }))
      .status,
    401,
  );
  const locked = await listen({ ...auth, production: true });
  try {
    assert.equal(
      (await request('/inspections', 'GET', undefined, { url: locked.url }))
        .status,
      503,
    );
  } finally {
    await new Promise((resolve) => locked.server.close(resolve));
  }
  await db
    .collection('roles')
    .updateOne({ _id: roleId }, { $set: { permissions: ['vehicle.intake'] } });
  assert.equal((await request('/intakes')).status, 200);
  assert.equal((await request('/inspections')).status, 403);
  await db
    .collection('users')
    .updateOne({ _id: actorId }, { $set: { account_status: 'suspended' } });
  assert.equal((await request('/inspection-vehicles')).status, 403);
});
test('candidate/eligibility endpoints expose only the required vehicle and owner fields', async () => {
  const result = await request('/inspection-vehicles?q=Toyota&limit=1');
  assert.equal(result.status, 200);
  assert.equal(result.body.pagination.total, 1);
  const data = result.body.data[0];
  assert.equal(data.eligible, true);
  assert.equal(data.baselineOdometerKm, 10000);
  assert.equal(data.owner.full_name, 'Test Owner');
  assert.equal(data.owner.password_hash, undefined);
  assert.equal(data.owner.payout_profile, undefined);
  assert.equal(data.vehicle.vin, undefined);
  assert.equal(data.vehicle.documents, undefined);
  assert.equal(
    (await request('/inspection-vehicles?q=.*')).body.pagination.total,
    0,
  );
  assert.equal(
    (await request(`/vehicles/${vehicleId}/inspection-eligibility`)).body.data
      .eligible,
    true,
  );
});
test('creates partial drafts, merges edits, and rejects stale versions and spoofed approval', async () => {
  const draft = await create({ vehicleId: String(vehicleId) });
  assert.equal(draft.approval_status, 'draft');
  assert.equal(draft.garage_staff_id, String(actorId));
  assert.equal(draft.inspected_at, undefined);
  assert.equal(draft.reviewed_by_manager_id, undefined);
  const updated = await request(`/inspections/${draft._id}`, 'PATCH', {
    version: 0,
    odometerKm: 10020,
    condition: { exterior: 'good', note: 'Đang kiểm tra.' },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.version, 1);
  const next = await request(`/inspections/${draft._id}`, 'PATCH', {
    version: 1,
    fuelLevelPct: 65,
    condition: { interior: 'good' },
  });
  assert.equal(next.body.data.condition_report.exterior, 'good');
  assert.equal(next.body.data.condition_report.interior, 'good');
  assert.equal(
    (
      await request(`/inspections/${draft._id}`, 'PATCH', {
        version: 0,
        fuelLevelPct: 50,
      })
    ).status,
    409,
  );
  for (const injected of [
    { approval_status: 'approved' },
    { garage_staff_id: String(otherActorId) },
    { reviewed_by_manager_id: String(actorId) },
    { inspection_type: 'periodic' },
  ]) {
    assert.equal(
      (
        await request(`/inspections/${draft._id}`, 'PATCH', {
          version: 2,
          ...injected,
        })
      ).status,
      400,
    );
  }
});
test('submits as pending, logs once and leaves vehicle approval/physical status unchanged', async () => {
  const draft = await create();
  const result = await submit(draft._id);
  assert.equal(result.status, 200);
  assert.equal(result.body.replayed, false);
  assert.equal(result.body.data.approval_status, 'pending');
  assert.equal(result.body.data.version, 1);
  assert.equal(result.body.data.recommendation, 'pass');
  assert.ok(Date.parse(result.body.data.inspected_at));
  assert.equal(result.body.data.reviewed_by_manager_id, undefined);
  const vehicle = await db.collection('vehicles').findOne({ _id: vehicleId });
  assert.equal(vehicle.onboarding_status, 'submitted');
  assert.equal(vehicle.physical_status, 'with_owner');
  assert.equal(vehicle.inspection_workflow_version, 1);
  const replay = await submit(draft._id);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(
    await db
      .collection('audit_logs')
      .countDocuments({ action: 'vehicle.inspection.submitted' }),
    1,
  );
  assert.equal(
    (
      await request(`/inspections/${draft._id}`, 'PATCH', {
        version: 1,
        fuelLevelPct: 10,
      })
    ).status,
    409,
  );
  assert.equal((await submit(draft._id, 123)).status, 409);
});
test('handles concurrent creation and submission without duplicate open reports or audit logs', async () => {
  const created = await Promise.all([
    request('/inspections', 'POST', fullDraft()),
    request('/inspections', 'POST', fullDraft()),
  ]);
  assert.deepEqual(created.map((item) => item.status).sort(), [201, 409]);
  const id = created.find((item) => item.status === 201).body.data._id;
  const results = await Promise.all([submit(id), submit(id)]);
  assert.ok(
    results.every((result) => result.status === 200),
    JSON.stringify(results),
  );
  assert.equal(results.filter((result) => !result.body.replayed).length, 1);
  assert.equal(await db.collection('audit_logs').countDocuments(), 1);
  assert.equal(
    (await request(`/vehicles/${vehicleId}/inspection-eligibility`)).body.data
      .eligible,
    false,
  );
});
test('rejects incomplete report, decreasing meter, abnormal pass and missing repair reasons', async () => {
  const draft = await create({ vehicleId: String(vehicleId) });
  assert.equal((await submit(draft._id)).status, 400);
  let version = 0;
  async function change(changes) {
    const result = await request(`/inspections/${draft._id}`, 'PATCH', {
      version,
      ...changes,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    version = result.body.data.version;
  }
  const { vehicleId: ignored, ...report } = fullDraft();
  await change({ ...report, odometerKm: 9999 });
  assert.equal((await submit(draft._id, version)).status, 400);
  await change({
    odometerKm: 10025,
    condition: { exterior: 'damaged', note: '' },
  });
  assert.equal((await submit(draft._id, version)).status, 400);
  await change({ condition: { note: 'Vết xước cần xử lý.' } });
  assert.equal((await submit(draft._id, version)).status, 400);
  await change({
    condition: { exterior: 'good', note: '' },
    recommendation: 'requires_repair',
  });
  assert.equal((await submit(draft._id, version)).status, 400);
  await change({
    condition: { exterior: 'attention', note: 'Cần kiểm tra lại cản sau.' },
  });
  assert.equal((await submit(draft._id, version)).status, 200);
});
test('rechecks vehicle eligibility when submitting a previously saved draft', async () => {
  const draft = await create();
  await db
    .collection('vehicles')
    .updateOne({ _id: vehicleId }, { $set: { onboarding_status: 'approved' } });
  let result = await submit(draft._id);
  assert.equal(result.status, 409);
  assert.ok(
    result.body.error.details.blockers.some(
      (item) => item.code === 'INVALID_ONBOARDING_STATUS',
    ),
  );
  await db
    .collection('vehicles')
    .updateOne(
      { _id: vehicleId },
      { $set: { onboarding_status: 'submitted', physical_status: 'rented' } },
    );
  result = await submit(draft._id);
  assert.equal(result.status, 409);
  assert.ok(
    result.body.error.details.blockers.some(
      (item) => item.code === 'INVALID_PHYSICAL_STATUS',
    ),
  );
  assert.equal(await db.collection('audit_logs').countDocuments(), 0);
});
test('rejects edits/submission by another staff member and supports mine filtering', async () => {
  const draft = await create();
  const other = await listen({ ...auth, userId: String(otherActorId) });
  try {
    assert.equal(
      (
        await request(
          `/inspections/${draft._id}`,
          'PATCH',
          { version: 0, fuelLevelPct: 20 },
          { url: other.url },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          `/inspections/${draft._id}/submit`,
          'POST',
          { version: 0 },
          { url: other.url },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request('/inspections?mine=true', 'GET', undefined, {
          url: other.url,
        })
      ).body.pagination.total,
      0,
    );
  } finally {
    await new Promise((resolve) => other.server.close(resolve));
  }
  assert.equal(
    (await request('/inspections?status=draft&mine=true&q=Vios')).body
      .pagination.total,
    1,
  );
});
test('manager-decided history remains immutable and a new round is allowed after revision', async () => {
  const draft = await create();
  await submit(draft._id);
  // Simulate a Manager decision; no approval API is exposed to Garage Staff.
  await db
    .collection('vehicle_inspections')
    .updateOne(
      { _id: new ObjectId(draft._id) },
      {
        $set: {
          approval_status: 'revision_required',
          reviewed_by_manager_id: new ObjectId(),
          decision_reason: 'Cần sửa cản sau.',
          decided_at: new Date(),
        },
      },
    );
  await db
    .collection('vehicles')
    .updateOne(
      { _id: vehicleId },
      { $set: { onboarding_status: 'revision_required' } },
    );
  assert.equal(
    (
      await request(`/inspections/${draft._id}`, 'PATCH', {
        version: 1,
        recommendation: 'pass',
      })
    ).status,
    409,
  );
  const next = await create();
  assert.notEqual(next._id, draft._id);
  const paged = await request('/inspections?limit=1&page=2');
  assert.equal(paged.body.pagination.total, 3);
  assert.equal(paged.body.pagination.totalPages, 3);
  assert.equal(paged.body.data.length, 1);
  assert.equal(
    (await request('/inspections?status=revision_required')).body.pagination
      .total,
    2,
  );
});
test('rolls back submission, vehicle touch and audit together on storage failure', async (t) => {
  t.mock.method(console, 'error', () => {});
  const draft = await create();
  await db.command({
    collMod: 'audit_logs',
    validator: { inspection_test_required: { $exists: true } },
  });
  try {
    assert.equal((await submit(draft._id)).status, 500);
    assert.equal(
      (
        await db
          .collection('vehicle_inspections')
          .findOne({ _id: new ObjectId(draft._id) })
      ).approval_status,
      'draft',
    );
    assert.equal(
      (await db.collection('vehicles').findOne({ _id: vehicleId }))
        .inspection_workflow_version,
      undefined,
    );
    assert.equal(await db.collection('audit_logs').countDocuments(), 0);
  } finally {
    await db.command({ collMod: 'audit_logs', validator: {} });
  }
});
test('validates IDs, query shapes, enum values, photo keys and server-controlled fields', async () => {
  assert.equal((await request('/inspections/invalid')).status, 400);
  assert.equal((await request(`/inspections/${new ObjectId()}`)).status, 404);
  assert.equal(
    (
      await request('/inspections', 'POST', {
        vehicleId: String(new ObjectId()),
      })
    ).status,
    404,
  );
  for (const body of [
    { ...fullDraft(), odometerKm: '10025' },
    { ...fullDraft(), fuelLevelPct: 101 },
    { ...fullDraft(), recommendation: 'approved' },
    { ...fullDraft(), condition: { exterior: 'okay' } },
    { ...fullDraft(), condition: { photoKeys: ['../private.jpg'] } },
    { ...fullDraft(), approval_status: 'approved' },
  ])
    assert.equal((await request('/inspections', 'POST', body)).status, 400);
  for (const query of [
    'page=0',
    'limit=101',
    'q=one&q=two',
    'status=done',
    'mine=bad',
  ])
    assert.equal((await request(`/inspections?${query}`)).status, 400);
  const draft = await create();
  assert.equal(
    (
      await request(`/inspections/${draft._id}/submit`, 'POST', {
        version: 0,
        approved: true,
      })
    ).status,
    400,
  );
});
