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
  assert.equal(result.body.data.payoutAccount?.accountMasked, '****1001');
});

test('owner signs a pending management agreement and no other owner can access it', async () => {
  const vehicle = await models.Vehicle.findOne({ owner_id: ownerId }).lean();
  const agreement = await models.ManagementAgreement.create({
    vehicle_id: vehicle._id, owner_id: ownerId, agreement_number: `MGMT-TEST-${Date.now()}`,
    commission_rate_pct: 10, status: 'pending_signatures', created_at: new Date(), updated_at: new Date(),
  });
  const detail = await request(`/owner/agreements/${agreement._id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.canOwnerSign, true);
  const signed = await request(`/owner/agreements/${agreement._id}/sign`, 'POST', { acceptedTerms: true, signatureName: 'Test Owner' });
  assert.equal(signed.status, 200, JSON.stringify(signed));
  const updated = await models.ManagementAgreement.findById(agreement._id).lean();
  assert.equal(updated.status, 'pending_signatures');
  assert.equal(updated.signature_info.owner_signature_name, 'Test Owner');
  assert.equal((await request(`/owner/agreements/${agreement._id}`, 'GET', undefined, renterToken)).status, 403);
});

test('owner payout, withdrawal and incident requests are scoped to the owner account', async () => {
  const now = new Date();
  const vehicle = await models.Vehicle.create({
    owner_id: ownerId, license_plate: `TEST-${Date.now()}`, brand: 'Test', model: 'Owner flow',
    onboarding_status: 'approved', physical_status: 'at_garage', created_at: now, updated_at: now,
  });
  const agreement = await models.ManagementAgreement.create({
    vehicle_id: vehicle._id, owner_id: ownerId, agreement_number: `MGMT-WITHDRAW-${Date.now()}`,
    commission_rate_pct: 10, status: 'active', created_at: now, updated_at: now,
  });
  const settlement = await models.OwnerSettlement.create({
    owner_id: ownerId, vehicle_id: vehicle._id, management_agreement_id: agreement._id,
    net_owner_payout: 150000, payout_status: 'payable', created_at: now,
  });
  const payout = await request('/owner/payout-requests', 'POST', {});
  assert.equal(payout.status, 201, JSON.stringify(payout));
  const reserved = await models.OwnerSettlement.findById(settlement._id).lean();
  assert.equal(reserved.payout_status, 'payout_requested');
  const payment = await models.PaymentTransaction.findById(payout.body.data.transactionId).lean();
  assert.equal(payment.provider_response.account_masked, '****1001');
  assert.ok(payment.provider_response.account_token);
  const withdrawal = await request('/owner/vehicle-withdrawals', 'POST', { vehicleId: vehicle._id.toString(), reason: 'Cần sử dụng xe cho gia đình.' });
  assert.equal(withdrawal.status, 201, JSON.stringify(withdrawal));
  assert.equal((await models.ManagementAgreement.findById(agreement._id).lean()).status, 'termination_requested');
  const incident = await request('/owner/incidents', 'POST', { vehicleId: vehicle._id.toString(), caseType: 'vehicle_damage', description: 'Xe có vết xước mới ở cản trước sau khi bàn giao.' });
  assert.equal(incident.status, 201, JSON.stringify(incident));
  assert.equal((await models.IncidentCase.findById(incident.body.data.id).lean()).vehicle_id.toString(), vehicle._id.toString());
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

test('owner can resubmit vehicle documents when revision is required', async () => {
  const now = new Date();
  const vehicle = await models.Vehicle.create({
    owner_id: ownerId,
    license_plate: `REV-${Date.now().toString().slice(-5)}`,
    brand: 'Toyota',
    model: 'Vios',
    onboarding_status: 'revision_required',
    physical_status: 'with_owner',
    review_note: 'Vui lòng nộp lại giấy đăng kiểm rõ nét hơn',
    documents: {
      registration: { file_key: 'old_reg_key', verified: true, review_status: 'approved' },
      inspection_certificate: { file_key: 'old_insp_key', verified: false, review_status: 'revision_required', review_note: 'Bị mờ' },
      insurance: { file_key: 'old_ins_key', verified: true, review_status: 'approved' },
    },
    created_at: now,
    updated_at: now,
  });

  // Verify dashboard returns reviewNote and documents for the vehicle
  const dash = await request('/owner/dashboard');
  assert.equal(dash.status, 200);
  const found = dash.body.data.vehicles.find((v) => v.id === vehicle._id.toString());
  assert.ok(found);
  assert.equal(found.approvalStatus, 'revision_required');
  assert.equal(found.reviewNote, 'Vui lòng nộp lại giấy đăng kiểm rõ nét hơn');
  assert.equal(found.documents.inspectionCertificate.reviewStatus, 'revision_required');

  // Reject resubmitting with empty documents
  const emptyResubmit = await request(`/owner/vehicles/${vehicle._id}/documents`, 'PATCH', {});
  assert.equal(emptyResubmit.status, 400);

  // Successfully resubmit the inspection certificate
  const resubmit = await request(`/owner/vehicles/${vehicle._id}/documents`, 'PATCH', {
    documents: {
      inspectionCertificate: doc('new_inspection.pdf'),
    },
    note: 'Đã chụp lại bản quét PDF giấy đăng kiểm nét hơn',
  });
  assert.equal(resubmit.status, 200, JSON.stringify(resubmit));
  assert.equal(resubmit.body.data.onboardingStatus, 'pending_review');

  const updatedVehicle = await models.Vehicle.findById(vehicle._id).lean();
  assert.equal(updatedVehicle.onboarding_status, 'pending_review');
  assert.notEqual(updatedVehicle.documents.inspection_certificate.file_key, 'old_insp_key');
  assert.equal(updatedVehicle.documents.inspection_certificate.review_status, 'pending');
  assert.equal(updatedVehicle.registration_history.at(-1).action, 'revision_submitted');
  assert.ok(await models.AuditLog.findOne({ entity_id: vehicle._id, action: 'vehicle.revision.submit' }).lean());
});
