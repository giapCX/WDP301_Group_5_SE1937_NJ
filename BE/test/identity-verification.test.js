import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { getModels } from '../src/models/index.js';
import { closeTestDatabase, connectTestDatabase } from '../test-support/seeded-database.js';

let connection, models, server, baseUrl, renterToken, managerToken, renterId;
const documentFile = (name) => ({ name, contentType: 'application/pdf', data: `data:application/pdf;base64,${Buffer.from('%PDF-1.4 test eKYC evidence').toString('base64')}` });
async function request(path, method = 'GET', body, token = renterToken) {
  const response = await fetch(`${baseUrl}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
const submission = () => ({ identity: { documentType: 'national_id', number: '012345678901', file: documentFile('cccd.pdf') }, driverLicense: { number: 'B2-12345678', class: 'B2', expiresAt: '2030-12-31', file: documentFile('license.pdf') } });

before(async () => {
  connection = await connectTestDatabase();
  models = getModels(connection);
  server = createApp(connection).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const renterRole = await models.Role.findOne({ code: 'RENTER' }).lean();
  const renter = await models.User.create({ full_name: 'KYC Test Renter', email: 'kyc-renter@example.com', account_status: 'active', primary_role_id: renterRole._id, created_at: new Date(), updated_at: new Date() });
  renterId = renter._id;
  renterToken = (await request('/auth/login', 'POST', { account: renter.email, password: '123456' }, null)).body.data.token;
  const managerRole = await models.Role.findOne({ code: 'MANAGER' }).lean();
  const manager = await models.User.findOne({ primary_role_id: managerRole._id }).lean();
  managerToken = (await request('/auth/login', 'POST', { account: manager.email, password: '123456' }, null)).body.data.token;
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await closeTestDatabase(); });

test('renter submits private identity and driving-license evidence for manual eKYC review', async () => {
  assert.equal((await request('/identity-verifications/me')).status, 200);
  const result = await request('/identity-verifications', 'POST', submission());
  assert.equal(result.status, 201, JSON.stringify(result));
  const renter = await models.User.findById(renterId).lean();
  assert.equal(renter.identity_kyc.status, 'pending');
  assert.equal(renter.driver_license.verification_status, 'pending');
  assert.match(renter.identity_kyc.evidence_key, /^[a-f\d]{24}$/);
  assert.equal(renter.identity_kyc.id_masked, '***8901');
  assert.ok(await models.AuditLog.findOne({ entity_id: renterId, action: 'identity_verification.submit' }).lean());
});

test('manager reviews the whole eKYC package and renter cannot access review endpoints', async () => {
  assert.equal((await request('/manager/identity-verifications')).status, 403);
  const queue = await request('/manager/identity-verifications?status=pending', 'GET', undefined, managerToken);
  assert.equal(queue.status, 200, JSON.stringify(queue));
  assert.ok(queue.body.data.some((item) => item.id === renterId.toString()));
  const reviewed = await request(`/manager/identity-verifications/${renterId}/review`, 'PATCH', { action: 'approve', note: '' }, managerToken);
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed));
  const renter = await models.User.findById(renterId).lean();
  assert.equal(renter.identity_kyc.status, 'verified');
  assert.equal(renter.driver_license.verification_status, 'verified');
  assert.ok(renter.identity_kyc.verified_at);
});
