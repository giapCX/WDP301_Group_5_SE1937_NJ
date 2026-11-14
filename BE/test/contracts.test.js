import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getModels } from '../src/models/index.js';
import { connectTestDatabase, closeTestDatabase } from '../test-support/seeded-database.js';

let models, server, base;
const tokens = {}, actors = {};
before(async () => {
  const connection = await connectTestDatabase(); models = getModels(connection);
  for (const [name, number] of Object.entries({ owner: 1, otherOwner: 2, renter: 8, otherRenter: 9, garage: 16, operation: 17, manager: 19, admin: 20 })) {
    const id = `02${number.toString(16).padStart(22, '0')}`;
    actors[name] = await models.User.findById(id).lean();
    tokens[name] = jwt.sign({ sub: id }, env.jwtSecret);
  }
  server = createApp(connection).listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { if (server) await new Promise((done) => server.close(done)); await closeTestDatabase(); });
async function request(path, method = 'GET', body, role = 'manager', status = 200) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tokens[role]}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result;
}
async function managementFixture() {
  const vehicle = await models.Vehicle.create({ owner_id: actors.owner._id, license_plate: randomUUID(), brand: 'Toyota', model: 'Vios', onboarding_status: 'approved', physical_status: 'with_owner', created_at: new Date() });
  await models.VehicleInspection.create({ vehicle_id: vehicle._id, garage_staff_id: actors.garage._id, inspection_type: 'onboarding', approval_status: 'approved', recommendation: 'pass', created_at: new Date(), inspected_at: new Date(), condition_report: { odometer_km: 10000 } });
  const row = await models.ManagementAgreement.create({ vehicle_id: vehicle._id, owner_id: actors.owner._id, agreement_number: randomUUID(), commission_rate_pct: 10, status: 'draft', created_at: new Date() });
  const prepare = () => request(`/contracts/management/prepare/${vehicle._id}`, 'POST', {});
  return { vehicle, row, prepare };
}
const signature = (row) => ({ acceptedTerms: true, signatureName: 'Người ký thử nghiệm', documentHash: row.document.hash });
const sign = (row, role, mode = 'party', body = signature(row), status = 200) => request(`/contracts/${row.type}/${row.id}/sign?view=${mode}`, 'POST', body, role, status);
async function rentalFixture() {
  const { vehicle } = await managementFixture();
  await models.Vehicle.updateOne({ _id: vehicle._id }, { $set: { physical_status: 'at_garage' } });
  const now = Date.now();
  const management = await models.ManagementAgreement.create({ vehicle_id: vehicle._id, owner_id: actors.owner._id, agreement_number: randomUUID(), status: 'active', start_date: new Date(now - 86400000), end_date: new Date(now + 365 * 86400000), signature_info: { owner_signed_at: new Date(now - 86400000), platform_signed_at: new Date(now - 86400000) }, authorization_scope: { vehicle_custody: true, rental_contract_signing: true } });
  const booking = await models.Booking.create({ booking_code: randomUUID(), renter_id: actors.renter._id, vehicle_id: vehicle._id, management_agreement_id: management._id, start_at: new Date(now + 2 * 86400000), end_at: new Date(now + 4 * 86400000), rental_fee_amount: 1000000, deposit_amount_snapshot: 3000000, pricing_snapshot: { daily_price: 500000 }, status: 'awaiting_payment', payment_deadline_at: new Date(now + 900000) });
  const prepare = () => request(`/contracts/rental/prepare/${booking._id}`, 'POST', {}, 'operation');
  return { vehicle, booking, prepare };
}

test('management requires approval, freezes displayed facts and separates both signers before intake', async () => {
  const fixture = await managementFixture();
  await models.Vehicle.updateOne({ _id: fixture.vehicle._id }, { $set: { onboarding_status: 'submitted' } });
  await request(`/contracts/management/prepare/${fixture.vehicle._id}`, 'POST', {}, 'manager', 409);
  await models.Vehicle.updateOne({ _id: fixture.vehicle._id }, { $set: { onboarding_status: 'approved' } });
  const row = (await fixture.prepare()).data;
  assert.ok(row.document.hash); assert.ok(row.document.facts.some((fact) => fact.value === '10%'));
  const owner = (await request(`/owner/agreements/${row.id}`, 'GET', undefined, 'owner')).data;
  assert.equal(owner.canOwnerSign, true);
  await request(`/owner/agreements/${row.id}/sign`, 'POST', signature(row), 'owner');
  assert.equal((await models.ManagementAgreement.findById(row.id).lean()).status, 'pending_signatures');
  const eligibilityPath = `/garage/vehicles/${fixture.vehicle._id}/intake-eligibility?managementAgreementId=${row.id}`;
  assert.equal((await request(eligibilityPath, 'GET', undefined, 'garage')).data.eligible, false);
  const signed = (await sign(row, 'manager', 'staff')).data;
  assert.equal(signed.status, 'active');
  assert.equal((await request(eligibilityPath, 'GET', undefined, 'garage')).data.eligible, true);
  const stored = await models.ManagementAgreement.findById(row.id).lean();
  assert.ok(stored.signature_info.owner_signer_user_id.equals(actors.owner._id));
  assert.ok(stored.platform_signer_id.equals(actors.manager._id));
  assert.deepEqual(signed.document, row.document);
});

test('new owner vehicle moves through scheduling, approval, paper signing and public listing', async () => {
  const doc = { name: 'xe.pdf', contentType: 'application/pdf', data: Buffer.from('%PDF-1.4 fixture').toString('base64') };
  const photo = { name: 'xe.png', contentType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL94AAAAASUVORK5CYII=' };
  const { data: submitted } = await request('/owner/vehicles', 'POST', {
    brand: 'Toyota', model: 'Vios', licensePlate: '30A-TEST-9001', vin: 'XEDI123456789',
    ownerContactAddress: 'Địa chỉ chủ xe thử nghiệm', publishVehiclePhotos: true, year: 2022, seats: 5,
    vehicleType: 'Sedan', transmission: 'automatic', fuelType: 'gasoline', dailyPrice: 700000,
    mileageLimit: 200, extraMileageFee: 3000, acceptedTerms: true,
    description: 'Xe thử nghiệm đủ điều kiện tiếp nhận.', conditionDeclaration: 'Chưa phát hiện lỗi.',
    documents: { registration: doc, inspectionCertificate: doc, insurance: doc }, photos: [photo, photo],
  }, 'owner', 201);
  const vehicleId = submitted.id;
  assert.ok(vehicleId);
  const documentPath = `${base}/operation/vehicles/${vehicleId}/documents/registration`;
  const inspectionFile = await fetch(documentPath, { headers: { Authorization: `Bearer ${tokens.operation}` } });
  assert.equal(inspectionFile.status, 200);
  assert.equal(inspectionFile.headers.get('content-type'), 'application/pdf');
  assert.equal((await fetch(documentPath, { headers: { Authorization: `Bearer ${tokens.owner}` } })).status, 403);
  const condition = { exterior: 'good', interior: 'good', engine: 'good', tires: 'good' };
  await request('/garage/inspections', 'POST', { vehicleId }, 'garage', 409);
  await request(`/operation/vehicles/${vehicleId}/screen`, 'PATCH', {
    action: 'schedule_inspection', garageStaffId: String(actors.garage._id),
    scheduledFor: new Date(Date.now() + 3600000).toISOString(), note: 'Kiểm định tại gara thử nghiệm.',
  }, 'operation');
  const inspection = await models.VehicleInspection.findOne({ vehicle_id: vehicleId, approval_status: 'draft' }).lean();
  const inspectionPath = `/garage/inspections/${inspection._id}`;
  const keys = ['identity', 'odometer', 'exterior', 'interior', 'tires', 'brakes', 'powertrain', 'leaks', 'lights', 'accessories'];
  await request(inspectionPath, 'PATCH', {
    version: 0, odometerKm: 10000, fuelLevelPct: 70, recommendation: 'pass',
    condition: { ...condition, checklist: keys.map((key) => ({ key, result: 'pass' })) },
  }, 'garage');
  const { data: report } = await request(`${inspectionPath}/submit`, 'POST', { version: 1 }, 'garage');
  const approval = { action: 'approve', note: '', inspectionId: report._id, inspectionVersion: report.version };
  const reviewPath = `/manager/vehicles/${vehicleId}/review`;
  await request(reviewPath, 'PATCH', approval, 'manager', 409);
  await request(`/owner/vehicles/${vehicleId}/inspections/${inspection._id}`, 'PATCH', { status: 'accepted', version: report.version }, 'owner');
  await request(reviewPath, 'PATCH', { ...approval, inspectionVersion: report.version + 1 });
  const { data: contract } = await request(`/contracts/management/prepare/${vehicleId}`, 'POST', {
    commissionRatePct: 12.5, place: 'Hà Nội', garage: 'Gara XeDi Hà Nội',
  });
  assert.equal(contract.document.version, 'xedi-management-paper-v1');
  assert.ok(contract.document.articles.length >= 6);
  assert.ok(contract.document.parties[0].facts.some(({ value }) => value === 'Địa chỉ chủ xe thử nghiệm'));
  assert.ok(contract.document.facts.some(({ value }) => value === '12.5%'));
  await sign(contract, 'owner');
  await sign(contract, 'manager', 'staff');
  const { data: intake } = await request('/garage/intakes', 'POST', {
    vehicleId, managementAgreementId: contract.id, odometerKm: 10020, fuelLevelPct: 70, condition,
  }, 'garage', 201);
  const confirmPath = `/garage/intakes/${intake._id}/confirm`;
  await request(confirmPath, 'POST', { version: intake.version, ownerConfirmed: true }, 'garage', 409);
  await request(`/owner/vehicles/${vehicleId}/intakes/${intake._id}`, 'PATCH', { status: 'accepted', version: intake.version }, 'owner');
  await request(confirmPath, 'POST', { version: intake.version + 1, ownerConfirmed: true }, 'garage');
  const listing = await models.VehicleListing.findOne({ vehicle_id: vehicleId }).lean();
  assert.equal(listing.status, 'draft');
  await request(`/listings/${listing._id}`, 'GET', undefined, 'owner', 404);
  const photoPath = base.slice(0, -4) + listing.photos[0];
  assert.equal((await fetch(photoPath)).status, 404);
  const listingPath = `/operation/listings/${listing._id}`;
  await request(`${listingPath}/review`, 'PATCH', { action: 'approve' }, 'operation', 409);
  await request(listingPath, 'PATCH', {
    securityDepositAmount: 3000000, pickupLocation: { branchName: 'Gara XeDi', city: 'Hà Nội', addressLabel: 'Gara thử nghiệm' },
  }, 'operation');
  await request(`${listingPath}/review`, 'PATCH', { action: 'approve' }, 'operation');
  assert.equal((await request(`/listings/${listing._id}`, 'GET', undefined, 'owner')).data.daily_price, 700000);
  const image = await fetch(photoPath);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  await request(`${listingPath}/review`, 'PATCH', { action: 'deactivate' }, 'operation');
  assert.equal((await fetch(photoPath)).status, 404);
});

test('ownership, staff authority, acceptance and stale document guards cannot be bypassed', async () => {
  const row = (await (await managementFixture()).prepare()).data;
  await sign(row, 'otherOwner', 'party', signature(row), 404);
  await sign(row, 'owner', 'staff', signature(row), 403);
  await sign(row, 'operation', 'staff', signature(row), 403);
  await sign(row, 'admin', 'staff', signature(row), 403);
  await sign(row, 'owner', 'party', { ...signature(row), acceptedTerms: false }, 400);
  await sign(row, 'owner', 'party', { ...signature(row), documentHash: 'stale' }, 409);
  await sign(row, 'manager', 'staff');
  await sign(row, 'manager', 'staff', signature(row), 409);
  assert.equal((await models.ManagementAgreement.findById(row.id).lean()).signature_info.owner_signed_at, undefined);
});

test('concurrent independent signatures preserve both signers and retry cannot duplicate an acceptance', async () => {
  const row = (await (await managementFixture()).prepare()).data;
  await Promise.all([sign(row, 'owner'), sign(row, 'manager', 'staff')]);
  const stored = await models.ManagementAgreement.findById(row.id).lean();
  assert.equal(stored.status, 'active');
  assert.ok(stored.signature_info.owner_signed_at && stored.signature_info.platform_signed_at);
  await sign(row, 'owner', 'party', signature(row), 409);
  assert.equal(await models.AuditLog.countDocuments({ entity_id: row.id, action: 'contract.sign' }), 2);
});

test('audit failure rolls back signature and contract status', async () => {
  const row = (await (await managementFixture()).prepare()).data;
  const original = models.AuditLog.collection.insertOne;
  models.AuditLog.collection.insertOne = async function (document, ...args) {
    if (document.action === 'contract.sign') throw new Error('Injected audit failure');
    return original.call(this, document, ...args);
  };
  try { await sign(row, 'owner', 'party', signature(row), 500); }
  finally { models.AuditLog.collection.insertOne = original; }
  const stored = await models.ManagementAgreement.findById(row.id).lean();
  assert.equal(stored.status, 'pending_signatures');
  assert.equal(stored.signature_info?.owner_signed_at, undefined);
});

test('Operation prepares rental snapshot, renter and Manager sign independently without marking money paid', async () => {
  const fixture = await rentalFixture(), row = (await fixture.prepare()).data;
  assert.equal(row.document.version, 'xedi-rental-paper-v1');
  assert.equal(row.document.parties.length, 2);
  assert.equal(row.document.articles.length, 9);
  assert.ok(row.document.facts.some(({ label }) => label === 'Biển số'));
  assert.match(row.document.articles[3].paragraphs[0], /Tiền cọc/);
  await sign(row, 'otherRenter', 'party', signature(row), 404);
  await sign(row, 'operation', 'staff', signature(row), 403);
  await sign(row, 'manager', 'staff');
  await sign(row, 'renter');
  const agreement = await models.RentalAgreement.findById(row.id).lean();
  assert.equal(agreement.status, 'signed');
  assert.ok(agreement.signed_at);
  assert.ok(agreement.signing_info.renter_signer_user_id.equals(actors.renter._id));
  assert.ok(agreement.signing_info.platform_signer_user_id.equals(actors.manager._id));
  assert.equal((await models.Booking.findById(fixture.booking._id).lean()).status, 'awaiting_payment');
  assert.equal(await models.PaymentTransaction.countDocuments({ booking_id: fixture.booking._id }), 0);
  const eligibility = (await request(`/garage/bookings/${fixture.booking._id}/handover-eligibility?type=pickup`, 'GET', undefined, 'garage')).data;
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.blockers.some((item) => item.code === 'RENTAL_UNPAID'));
  assert.ok(!eligibility.blockers.some((item) => item.code === 'RENTAL_NOT_SIGNED'));
  const own = await request('/contracts/rental?page=1&limit=100', 'GET', undefined, 'renter');
  assert.ok(own.data.some((item) => item.id === row.id));
});

test('rental cannot sign changed, cancelled or expired bookings; management cannot rewrite a signed document', async () => {
  const first = await rentalFixture(), row = (await first.prepare()).data;
  await models.Booking.updateOne({ _id: first.booking._id }, { $set: { rental_fee_amount: 2000000 } });
  await sign(row, 'renter', 'party', signature(row), 409);
  await models.Booking.updateOne({ _id: first.booking._id }, { $set: { status: 'cancelled' } });
  await sign(row, 'renter', 'party', signature(row), 409);
  const second = await rentalFixture();
  await models.Booking.updateOne({ _id: second.booking._id }, { $set: { payment_deadline_at: new Date(0) } });
  await request(`/contracts/rental/prepare/${second.booking._id}`, 'POST', {}, 'operation', 409);
  const fixture = await managementFixture(), management = (await fixture.prepare()).data;
  await sign(management, 'owner');
  const again = (await request(`/contracts/management/prepare/${fixture.vehicle._id}`, 'POST', { endDate: '2040-01-01' })).data;
  assert.deepEqual(again.document, management.document);
});
