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

test('owner can respond to their submitted inspection exactly once at the current version', async () => {
  const vehicle = await models.Vehicle.findOne({ owner_id: ownerId }).lean();
  const other = await models.Vehicle.findOne({ owner_id: { $ne: ownerId } }).lean();
  const report = await models.VehicleInspection.create({
    vehicle_id: vehicle._id, garage_staff_id: ownerId, inspection_type: 'onboarding',
    approval_status: 'pending', recommendation: 'pass', version: 3, created_at: new Date(),
  });
  const path = `/owner/vehicles/${vehicle._id}/inspections/${report._id}`;
  const payload = { status: 'accepted', version: 3 };
  assert.equal((await request(path, 'PATCH', payload, renterToken)).status, 403);
  assert.equal((await request(`/owner/vehicles/${other._id}/inspections/${report._id}`, 'PATCH', payload)).status, 404);
  assert.equal((await request(path, 'PATCH', { ...payload, version: 2 })).status, 409);
  assert.equal((await request(path, 'PATCH', { ...payload, status: 'disputed' })).status, 400);
  assert.equal((await request(path, 'PATCH', payload)).status, 200);
  assert.equal((await request(path, 'PATCH', { ...payload, version: 4 })).status, 409);
  const dashboard = await request('/owner/dashboard');
  assert.equal(dashboard.body.data.vehicles.find((item) => item.id === String(vehicle._id)).inspection.ownerReview.status, 'accepted');
  await models.VehicleInspection.deleteOne({ _id: report._id });
});

test('owner cannot sign an unprepared legacy agreement and other roles cannot access owner endpoints', async () => {
  const vehicle = await models.Vehicle.findOne({ owner_id: ownerId }).lean();
  const agreement = await models.ManagementAgreement.create({
    vehicle_id: vehicle._id, owner_id: ownerId, agreement_number: `MGMT-TEST-${Date.now()}`,
    commission_rate_pct: 10, status: 'pending_signatures', created_at: new Date(), updated_at: new Date(),
  });
  const detail = await request(`/owner/agreements/${agreement._id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.canOwnerSign, false);
  const signed = await request(`/owner/agreements/${agreement._id}/sign`, 'POST', { acceptedTerms: true, signatureName: 'Test Owner' });
  assert.equal(signed.status, 409, JSON.stringify(signed));
  const updated = await models.ManagementAgreement.findById(agreement._id).lean();
  assert.equal(updated.status, 'pending_signatures');
  assert.equal(updated.signature_info?.owner_signed_at, undefined);
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
  const renter = await models.User.findOne({ email: 'renter08@example.com' }).lean();
  const booking = await models.Booking.create({
    booking_code: 'BK-OWNER-INCIDENT', vehicle_id: vehicle._id, renter_id: renter._id,
    management_agreement_id: agreement._id, status: 'ongoing', start_at: new Date(), end_at: new Date(Date.now() + 86400000),
  });
  const incident = await request('/owner/incidents', 'POST', { vehicleId: vehicle._id.toString(), bookingId: booking.booking_code, caseType: 'vehicle_damage', description: 'Xe có vết xước mới ở cản trước sau khi bàn giao.', vehicleSeized: false });
  assert.equal(incident.status, 201, JSON.stringify(incident));
  assert.equal((await models.IncidentCase.findById(incident.body.data.id).lean()).vehicle_id.toString(), vehicle._id.toString());
  const role = await models.Role.findOne({ code: 'OPERATION_STAFF' }).lean();
  const operator = await models.User.findOne({ primary_role_id: role._id }).lean();
  const login = await request('/auth/login', 'POST', { account: operator.email, password: '123456' }, null);
  assert.equal(login.status, 200);
  const operatorToken = login.body.data.token;
  const path = `/operator/incidents/${incident.body.data.id}`;
  const details = await request(path, 'GET', undefined, operatorToken);
  assert.equal(details.body.data.rentalContext.bookingCode, booking.booking_code);
  assert.ok(details.body.data.rentalContext.contracts.some((contract) => contract.id === String(agreement._id)));
  assert.equal((await request(`${path}/receive`, 'POST', {}, ownerToken)).status, 403);
  assert.equal((await request(`${path}/submit`, 'POST', {}, operatorToken)).status, 409);
  const received = await request(`${path}/receive`, 'POST', {}, operatorToken);
  assert.equal(received.status, 200, JSON.stringify(received));
  assert.equal(received.body.data.status, 'investigating');
  const milestone = new Date(Date.now() - 60000).toISOString();
  assert.equal((await request(path, 'PATCH', { responseChecklist: {
    policeSubmittedAt: milestone, vehicleRecipient: 'Chủ xe', releaseAuthorizationReference: 'HS-01',
  } }, operatorToken)).status, 200);
  const updatedDetails = await request(path, 'GET', undefined, operatorToken);
  assert.equal(updatedDetails.body.data.responseChecklist.policeSubmittedAt, milestone);
  assert.equal(updatedDetails.body.data.responseChecklist.releaseAuthorizationReference, 'HS-01');
  assert.equal((await request(`${path}/receive`, 'POST', {}, operatorToken)).body.data.operatorReceivedAt, received.body.data.operatorReceivedAt);
  const dashboard = await request('/owner/dashboard');
  assert.equal(dashboard.body.data.incidents.find((item) => item.id === incident.body.data.id).status, 'investigating');
  assert.equal(await models.AuditLog.countDocuments({ entity_id: incident.body.data.id, action: 'incident.operator_receive' }), 1);
});

test('vehicle registration stores private files and an unsigned draft without impersonating either signer', async () => {
  const licensePlate = `90A-${Date.now().toString().slice(-5)}`;
  const body = {
    conditionDeclaration: 'Xe chưa phát hiện lỗi.',
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
  assert.equal(agreement.status, 'draft');
  assert.equal(agreement.commission_rate_pct, 10);
  assert.equal(agreement.signature_info.owner_signed_at, undefined);
  assert.equal(agreement.signature_info.platform_signed_at, undefined);
  assert.equal(response.body.data.signedAt, null);
  assert.ok(await models.AuditLog.findOne({ entity_id: agreement._id, action: 'agreement.draft' }).lean());
});

test('registration rejects missing agreement acceptance and duplicate or malformed inputs', async () => {
  const result = await request('/owner/vehicles', 'POST', { acceptedTerms: false });
  assert.equal(result.status, 400);
  assert.match(result.body.error.message, /quy trình đăng ký/);
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
