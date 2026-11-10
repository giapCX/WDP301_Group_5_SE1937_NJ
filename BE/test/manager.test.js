import assert from 'node:assert/strict';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import { Types } from 'mongoose';
import { createApp } from '../src/app.js';
import { getModels } from '../src/models/index.js';
import { connectTestDatabase, closeTestDatabase } from '../test-support/seeded-database.js';

let connection, models, server, baseUrl, managerToken, garageToken, adminToken, managerId;
async function request(path, method = 'GET', body, token = managerToken) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  connection = await connectTestDatabase();
  models = getModels(connection);
  server = createApp(connection).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const managerRole = await models.Role.findOne({ code: 'MANAGER' }).lean();
  const user = await models.User.findOne({ primary_role_id: managerRole._id }).lean();
  const login = await request('/auth/login', 'POST', { account: user.email, password: '123456' }, null);
  assert.equal(login.status, 200);
  managerToken = login.body.data.token;
  managerId = user._id;
  const garageLogin = await request('/auth/login', 'POST', { account: 'garage15@example.com', password: '123456' }, null);
  assert.equal(garageLogin.status, 200);
  garageToken = garageLogin.body.data.token;
  const adminRole = await models.Role.findOne({ code: 'ADMIN' }).lean();
  const admin = await models.User.findOne({ primary_role_id: adminRole._id }).lean();
  const adminLogin = await request('/auth/login', 'POST', { account: admin.email, password: '123456' }, null);
  assert.equal(adminLogin.status, 200);
  adminToken = adminLogin.body.data.token;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeTestDatabase();
});

test('manager read endpoints use Mongoose and keep role protection and public response shapes', async () => {
  assert.equal((await request('/manager/dashboard', 'GET', undefined, null)).status, 401);
  assert.equal((await request('/manager/dashboard', 'GET', undefined, garageToken)).status, 403);
  for (const path of ['dashboard', 'vehicles?status=all', 'incidents?status=all', 'policies', 'staff', 'reports/inspections', 'reports/finance']) {
    const result = await request(`/manager/${path}`);
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.ok(result.body.data);
  }
});

test('vehicle review keeps review fields, nested history and the manager audit actor', async () => {
  const vehicle = await models.Vehicle.findOne({ onboarding_status: 'submitted' }).lean();
  assert.ok(vehicle);
  const result = await request(`/manager/vehicles/${vehicle._id}/review`, 'PATCH', { action: 'revision', note: 'Check documents' });
  assert.equal(result.status, 200, JSON.stringify(result));
  const updated = await models.Vehicle.findById(vehicle._id).lean();
  assert.equal(updated.onboarding_status, 'revision_required');
  assert.equal(updated.review_note, 'Check documents');
  assert.equal(updated.registration_history.at(-1).note, 'Check documents');
  const audit = await models.AuditLog.findOne({ entity_id: vehicle._id, action: 'vehicle.revision' }).lean();
  assert.ok(audit.actor_user_id.equals(managerId));
});

test('incident compensation and resolution retain nested fields through strict schemas', async () => {
  const vehicle = await models.Vehicle.findOne().lean();
  const incident = await models.IncidentCase.create({
    case_number: 'MONGOOSE-CLAIM', vehicle_id: vehicle._id, description: 'Test damage', status: 'reported',
    compensation_claims: [{ requested_amount: 100, decision: 'pending' }],
  });
  assert.equal((await request(`/manager/incidents/${incident._id}/compensation`, 'PATCH', { decision: 'approve', amount: 80, note: 'Evidence checked' })).status, 409);
  const originalBooking = await models.Booking.findOne().lean();
  const booking = await models.Booking.create({ ...originalBooking, _id: new Types.ObjectId(), booking_code: 'MONGOOSE-CLAIM-BOOKING', vehicle_id: vehicle._id });
  await models.SecurityDeposit.create({ booking_id: booking._id, collected_amount: 100, refundable_amount: 100, deducted_amount: 0, status: 'collected' });
  await models.IncidentCase.updateOne({ _id: incident._id }, { $set: { booking_id: booking._id } });
  const result = await request(`/manager/incidents/${incident._id}/compensation`, 'PATCH', { decision: 'approve', amount: 80, note: 'Evidence checked' });
  assert.equal(result.status, 200, JSON.stringify(result));
  const updated = await models.IncidentCase.findById(incident._id).lean();
  assert.equal(updated.status, 'resolved');
  assert.equal(updated.compensation_claims[0].manager_note, 'Evidence checked');
  assert.equal(updated.resolution.amount, 80);
  assert.equal((await models.SecurityDeposit.findOne({ booking_id: booking._id }).lean()).refundable_amount, 20);
  const other = await models.IncidentCase.create({ case_number: 'MONGOOSE-RESOLVE', vehicle_id: vehicle._id, description: 'No claim', status: 'reported' });
  assert.equal((await request(`/manager/incidents/${other._id}/review`, 'PATCH', { action: 'resolve', note: 'Closed after review' })).status, 200);
});

test('policy versioning and staff updates validate through Mongoose', async () => {
  const policy = await request('/manager/policies/commission_default', 'PUT', { config: { default_commission_pct: 12, existing_agreements_unaffected: true } });
  assert.equal(policy.status, 201, JSON.stringify(policy));
  assert.ok(Types.ObjectId.isValid(policy.body.data.id));
  assert.equal(await models.PlatformPolicy.countDocuments({ policy_type: 'commission_default', status: 'active' }), 1);
  const role = await models.Role.findOne({ code: 'GARAGE_STAFF' }).lean();
  const employee = await models.User.create({ email: 'mongoose-staff@example.com', account_status: 'active', primary_role_id: role._id });
  const result = await request(`/manager/staff/${employee._id}`, 'PATCH', { status: 'suspended', role: 'OPERATION_STAFF' });
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal((await models.User.findById(employee._id).lean()).account_status, 'suspended');
});

test('merged admin endpoints enforce separate roles and persist accounts and role permissions', async () => {
  assert.equal((await request('/manager/accounts')).status, 403);
  assert.equal((await request('/manager/vehicles', 'GET', undefined, adminToken)).status, 403);
  for (const path of ['accounts', 'roles', 'audit-logs', 'reports/system']) {
    assert.equal((await request(`/manager/${path}`, 'GET', undefined, adminToken)).status, 200, path);
  }
  const role = await request('/manager/roles', 'POST', { code: 'TEST_SUPPORT', name: 'Test support', permissions: ['case.read'] }, adminToken);
  assert.equal(role.status, 201, JSON.stringify(role));
  assert.deepEqual((await models.Role.findById(role.body.data.id).lean()).permissions, ['case.read']);
  const account = await request('/manager/accounts', 'POST', { name: 'Test account', email: 'merged-account@example.com', password: 'test-password-1937', roles: ['TEST_SUPPORT'] }, adminToken);
  assert.equal(account.status, 201, JSON.stringify(account));
  const stored = await models.User.findById(account.body.data.id).lean();
  assert.ok(stored.password_hash.startsWith('$2'));
  assert.equal(stored.primary_role_id.toString(), role.body.data.id);
  assert.equal((await request(`/manager/accounts/${stored._id}`, 'PATCH', { status: 'suspended' }, adminToken)).status, 200);
  assert.equal((await models.User.findById(stored._id).lean()).account_status, 'suspended');
});

test('merged manager staff fields, contract amendments and saved reports survive strict schemas', async () => {
  const staff = await request('/manager/staff', 'POST', { name: 'Merge staff', email: 'merged-staff@example.com', password: 'test-password-1937', role: 'GARAGE_STAFF', department: 'Garage', jobTitle: 'Inspector', workScope: 'Branch A' });
  assert.equal(staff.status, 201, JSON.stringify(staff));
  assert.equal((await models.User.findById(staff.body.data.id).lean()).work_scope, 'Branch A');
  for (const [type, Model] of [['management', models.ManagementAgreement], ['rental', models.RentalAgreement]]) {
    const contract = await Model.findOne().lean();
    const amendment = await request(`/manager/contracts/${type}/${contract._id}`, 'PATCH', { action: 'amend', reason: 'Terms proposed for acceptance', proposedTerms: { daily_rate: 700000 } });
    assert.equal(amendment.status, 201, JSON.stringify(amendment));
    const updated = await Model.findById(contract._id).lean();
    assert.deepEqual(updated.amendments[0].proposed_terms, { daily_rate: 700000 });
    assert.equal(updated.amendments[0].status, 'pending_signatures');
    assert.equal(updated.status, contract.status);
    assert.equal((await request(`/manager/contracts/${type}/${contract._id}`, 'PATCH', { action: 'review', reason: 'Reviewed evidence', note: 'Contract checked' })).status, 200);
    assert.equal((await Model.findById(contract._id).lean()).manager_review.note, 'Contract checked');
  }
  const report = await request('/manager/reports/system', 'POST', { type: 'operations', from: '2026-01-01', to: '2026-12-31' });
  assert.equal(report.status, 201, JSON.stringify(report));
  const detail = await request(`/manager/reports/system/${report.body.data.id}`);
  assert.equal(detail.status, 200, JSON.stringify(detail));
  assert.ok(detail.body.data.report.bookings);
  assert.equal((await request(`/manager/reports/system/${report.body.data.id}`, 'GET', undefined, adminToken)).status, 404);
});

test('failed login writes masked authentication audit without a target entity', async () => {
  await request('/auth/login', 'POST', { account: 'unknown-merge@example.com', password: 'incorrect' }, null);
  const audit = await models.AuditLog.findOne({ action: 'auth.login_failed', 'sanitized_changes.account': 'u***@example.com' }).lean();
  assert.ok(audit);
  assert.equal(audit.entity_id, null);
});
