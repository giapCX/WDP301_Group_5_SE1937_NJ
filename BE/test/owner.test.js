import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { getModels } from '../src/models/index.js';
import { closeTestDatabase, connectTestDatabase } from '../test-support/seeded-database.js';

let connection, models, server, baseUrl, ownerToken, ownerId, renterToken;
const doc = (name, contentType = 'application/pdf') => ({
  name, contentType, data: `data:${contentType};base64,${Buffer.from('test document').toString('base64')}`,
});
async function request(path, method = 'GET', body, token = ownerToken) {
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
  const ownerRole = await models.Role.findOne({ code: 'OWNER' }).lean();
  const owner = await models.User.findOne({ primary_role_id: ownerRole._id }).lean();
  ownerId = owner._id;
  const ownerLogin = await request('/auth/login', 'POST', { account: owner.email, password: '123456' }, null);
  assert.equal(ownerLogin.status, 200);
  ownerToken = ownerLogin.body.data.token;
  const renter = await models.User.findOne({ email: 'renter08@example.com' }).lean();
  const renterLogin = await request('/auth/login', 'POST', { account: renter.email, password: '123456' }, null);
  assert.equal(renterLogin.status, 200);
  renterToken = renterLogin.body.data.token;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeTestDatabase();
});

test('owner dashboard is role-protected and only returns the signed-in owner records', async () => {
  const ownVehicle = await models.Vehicle.findOne({ owner_id: ownerId }).lean();
  const otherVehicle = await models.Vehicle.findOne({ owner_id: { $ne: ownerId } }).lean();
  assert.ok(ownVehicle);
  assert.equal((await request('/owner/dashboard', 'GET', undefined, null)).status, 401);
  assert.equal((await request('/owner/dashboard', 'GET', undefined, renterToken)).status, 403);
  const result = await request('/owner/dashboard');
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.ok(result.body.data.vehicles.every((vehicle) => vehicle.id !== otherVehicle?._id.toString()));
  assert.ok(result.body.data.agreements.every((agreement) => agreement.number));
});

test('vehicle registration stores private files, signs a management agreement and submits the vehicle', async () => {
  const licensePlate = `90A-${Date.now().toString().slice(-5)}`;
  const body = {
    brand: 'Test', model: 'Owner Car', licensePlate, year: 2022, seats: 5,
    vehicleType: 'Sedan', transmission: 'automatic', fuelType: 'gasoline',
    dailyPrice: 500000, mileageLimit: 200, extraMileageFee: 3000,
    description: 'Test vehicle registration for owner agreement flow.', acceptedTerms: true,
    documents: {
      registration: doc('registration.pdf'),
      inspectionCertificate: doc('inspection.pdf'),
      insurance: doc('insurance.pdf'),
    },
    photos: [doc('exterior.jpg', 'image/jpeg'), doc('interior.jpg', 'image/jpeg')],
  };
  const response = await request('/owner/vehicles', 'POST', body);
  assert.equal(response.status, 201, JSON.stringify(response));
  const vehicle = await models.Vehicle.findById(response.body.data.id).lean();
  const agreement = await models.ManagementAgreement.findById(response.body.data.agreementId).lean();
  assert.equal(vehicle.onboarding_status, 'submitted');
  assert.equal(vehicle.owner_id.toString(), ownerId.toString());
  assert.equal(vehicle.documents.insurance.verified, false);
  assert.equal(vehicle.photos.length, 2);
  assert.equal(agreement.status, 'active');
  assert.equal(agreement.commission_rate_pct, 10);
  assert.equal(agreement.signature_info.method, 'electronic_acceptance');
  assert.ok(agreement.signature_info.owner_signed_at);
  assert.ok(agreement.signature_info.platform_signed_at);
  assert.ok(await models.AuditLog.findOne({ entity_id: agreement._id, action: 'agreement.sign' }).lean());
});

test('registration rejects missing agreement acceptance and duplicate or malformed inputs', async () => {
  const result = await request('/owner/vehicles', 'POST', { acceptedTerms: false });
  assert.equal(result.status, 400);
  assert.match(result.body.error.message, /điều khoản/);
});
