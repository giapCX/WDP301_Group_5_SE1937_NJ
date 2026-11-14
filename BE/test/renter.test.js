import { createGarageHandoverRepository } from '../src/repositories/garage-handover.repository.js';
import { createGarageHandoverService } from '../src/service/garage-handover.service.js';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { Types } from 'mongoose';
import { connectTestDatabase, closeTestDatabase } from '../test-support/seeded-database.js';
import { createRenterRepository } from '../src/repositories/renter.repository.js';
import { createRenterService, selectPolicies, rentalDates, cancellationDecision } from '../src/service/renter.service.js';
import { createListingRepository } from '../src/repositories/listing.repository.js';
import { createApp } from '../src/app.js';
import { once } from 'node:events';
async function contractRequest(path, account, body, expected = 200) {
  const response = await fetch(base + '/api' + path, {
    method: path.startsWith('/operation/') ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${jwt.sign({ sub: String(account._id) }, env.jwtSecret)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result.data;
}

const oid = () => new Types.ObjectId();
let db, repo, service, user, other, listing, vehicle, management, booking, server, base;
const start = new Date(Date.now() + 10 * 86400000),
  end = new Date(+start + 2 * 86400000);
const payload = key => ({
  listing_id: String(listing._id),
  start_at: start.toISOString(),
  end_at: end.toISOString(),
  agreed: true,
  request_key: key
});
before(async () => {
  db = await connectTestDatabase();
  repo = createRenterRepository(db);
  service = createRenterService(repo, {
    demo: true
  });
  const role = await db.db.collection('roles').findOne({
    code: 'RENTER'
  });
  user = {
    _id: oid(),
    full_name: 'Khách Thuê',
    email: 'rentertest@example.com',
    phone: '0911111111',
    primary_role_id: role._id,
    additional_role_ids: [],
    account_status: 'active',
    contact_profile: {
      address: 'Địa chỉ khách thuê',
      city: 'Hà Nội'
    },
    identity_kyc: {
      status: 'verified'
    },
    driver_license: {
      class: 'B2',
      verification_status: 'verified',
      expires_at: new Date(+end + 86400000)
    }
  };
  other = {
    ...user,
    _id: oid(),
    email: 'other-rentertest@example.com',
    phone: '0922222222'
  };
  vehicle = {
    _id: oid(),
    owner_id: oid(),
    brand: 'Test',
    model: 'Renter',
    license_plate: 'TEST-RENTER',
    onboarding_status: 'approved',
    physical_status: 'at_garage'
  };
  management = {
    _id: oid(),
    vehicle_id: vehicle._id,
    owner_id: vehicle.owner_id,
    agreement_number: 'TEST-RENTER-MGMT',
    platform_signer_id: oid(),
    start_date: new Date(Date.now() - 86400000),
    end_date: new Date(+end + 365 * 86400000),
    status: 'active',
    commission_rate_pct: 15,
    authorization_scope: {
      rental_contract_signing: true,
      vehicle_custody: true
    },
    signature_info: {
      owner_signed_at: new Date(),
      platform_signed_at: new Date()
    }
  };
  listing = {
    _id: oid(),
    vehicle_id: vehicle._id,
    title: 'Xe thử nghiệm renter',
    status: 'published',
    daily_price: 700000,
    security_deposit_amount: 3000000,
    pickup_location: {
      branch_name: 'Gara thử nghiệm',
      city: 'Hà Nội'
    },
    mileage_policy: {
      included_km_per_day: 200,
      extra_km_fee: 3000
    },
    rental_policy_snapshot: {
      late_fee_per_hour: 100000
    }
  };
  for (const [name, doc] of [['users', user], ['users', other], ['vehicles', vehicle], ['management_agreements', management], ['vehicle_listings', listing]]) await repo.insert(name, doc);
  server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await closeTestDatabase();
});
test('profile saves with unchanged legacy contact data and validates replacements', async () => {
  const legacyAvatar = 'demo/avatars/user-01.jpg';
  const renter = {
    ...other,
    _id: oid(),
    email: 'legacy-avatar@example.com',
    phone: '090 123 4567',
    contact_profile: { ...other.contact_profile, avatar_key: legacyAvatar }
  };
  await repo.insert('users', renter);
  const payload = {
    full_name: 'Khách Thuê Đã Sửa',
    email: renter.email,
    phone: renter.phone,
    address: 'Địa chỉ đã cập nhật',
    avatar_key: legacyAvatar
  };
  const saved = await service.updateProfile(renter, payload);
  assert.equal(saved.full_name, payload.full_name);
  assert.equal(saved.phone, renter.phone);
  assert.equal(saved.contact_profile.address, payload.address);
  assert.equal(saved.contact_profile.avatar_key, legacyAvatar);
  await assert.rejects(
    service.updateProfile(renter, { ...payload, phone: '0123456789' }),
    /số điện thoại Việt Nam không hợp lệ/
  );
  await assert.rejects(
    service.updateProfile(renter, { ...payload, phone: '0978152463' }),
    /Cần xác thực OTP/
  );
  await assert.rejects(
    service.updateProfile(renter, { ...payload, avatar_key: 'demo/avatars/other.jpg' }),
    /Mã định danh không hợp lệ/
  );
});

test('policy selection excludes inactive, future and expired versions', () => {
  const now = new Date('2026-11-10');
  const result = selectPolicies([{
    policy_type: 'cancellation',
    status: 'active',
    version: 1,
    config: {
      free_cancel_before_hours: 48
    }
  }, {
    policy_type: 'cancellation',
    status: 'active',
    version: 2,
    effective_from: new Date('2026-12-01')
  }, {
    policy_type: 'cancellation',
    status: 'active',
    version: 3,
    effective_until: new Date('2026-11-01')
  }, {
    policy_type: 'cancellation',
    status: 'inactive',
    version: 4
  }], now);
  assert.equal(result.cancellation.version, 1);
  assert.throws(() => cancellationDecision({
    start_at: now
  }, null, now), {
    status: 409
  });
  assert.equal(cancellationDecision({
    start_at: new Date(+now + 47 * 3600000),
    rental_fee_amount: 10
  }, result.cancellation, now).refund_amount, null);
  assert.throws(() => rentalDates({
    start_at: new Date(+now + 3600000),
    end_at: new Date(+now + 30 * 3600000)
  }, now), {
    status: 400
  });
});
test('renter API requires authentication and exposes no OTP unless configured', async () => {
  assert.equal((await fetch(base + '/api/renter/bookings')).status, 401);
  const res = await fetch(base + '/api/renter/register/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'new@example.com',
      phone: '0933333333'
    })
  });
  assert.equal(res.status, 503);
  const config = await (await fetch(base + '/api/renter/config')).json();
  assert.equal(config.data.services.payment, 'unconfigured');
});
test('published vehicles outside the garage are hidden and cannot be booked', async () => {
  const vehicles = db.db.collection('vehicles');
  const filter = { _id: vehicle._id };
  try {
    for (const physical_status of ['rented', 'with_owner', 'maintenance', 'returned_to_owner']) {
      await vehicles.updateOne(filter, { $set: { physical_status } });
      const response = await fetch(`${base}/api/listings/${listing._id}`);
      assert.equal(response.status, 404);
      const catalog = await (await fetch(`${base}/api/listings?limit=100`)).json();
      assert.ok(catalog.data.every((item) => item._id !== String(listing._id)));
      await assert.rejects(service.createBooking(user, payload('not-at-garage')), {
        status: 409,
        message: 'Xe chưa sẵn sàng tại gara.'
      });
    }
  } finally {
    await vehicles.updateOne(filter, { $set: { physical_status: 'at_garage' } });
  }
  const response = await fetch(`${base}/api/listings/${listing._id}`);
  assert.equal(response.status, 200);
});

test('concurrent overlapping reservations cannot both succeed; amounts come from listing', async () => {
  const results = await Promise.allSettled([service.createBooking(user, {
    ...payload('concurrent-a'),
    rental_fee_amount: 1
  }), service.createBooking(user, payload('concurrent-b'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  booking = results.find(r => r.status === 'fulfilled').value.booking;
  assert.equal(booking.rental_fee_amount, 1400000);
  assert.equal(booking.deposit_amount_snapshot, 3000000);
  assert.equal(booking.status, 'pending');
  assert.equal((booking.hold_expires_at - booking.created_at) / 60000, 120);
  const replay = await service.createBooking(user, payload(booking.request_key));
  assert.equal(String(replay.booking._id), String(booking._id));
});
test('renter cannot inspect another account booking or upload forged file types', async () => {
  await assert.rejects(service.detail(other, String(booking._id)), {
    status: 404
  });
  await assert.rejects(service.upload(user, {
    purpose: 'incident',
    name: 'bad.png',
    content_type: 'image/png',
    data: Buffer.from('not png').toString('base64')
  }), {
    status: 400
  });
});
test('expired hold releases schedule and public search does not exclude the vehicle', async () => {
  await repo.update('bookings', {
    _id: booking._id
  }, {
    $set: {
      hold_expires_at: new Date(Date.now() - 1000)
    }
  });
  const found = await createListingRepository(db).findPublic({
    match: {
      _id: listing._id,
      status: 'published'
    },
    vehicleMatch: {},
    rentalPeriod: {
      start,
      end
    },
    sort: {
      _id: 1
    },
    page: 1,
    limit: 10
  });
  assert.equal(found.data.length, 1);
  await assert.rejects(service.pay(user, String(booking._id), {
    agree_deposit: true,
    payment_method: 'VNPAY_QR'
  }), {
    status: 409
  });
  booking = (await service.createBooking(user, payload('after-expiry'))).booking;
});
test('Operation approves, both parties sign the same rental contract and payment is idempotent', async () => {
  const operationRole = await repo.one('roles', { code: 'OPERATION_STAFF' });
  const managerRole = await repo.one('roles', { code: 'MANAGER' });
  const operation = await repo.one('users', { primary_role_id: operationRole._id, account_status: 'active' });
  const manager = await repo.one('users', { primary_role_id: managerRole._id, account_status: 'active' });
  const decision = await contractRequest(`/operation/bookings/${booking._id}/decision`, operation, { action: 'approve' });
  const approved = await repo.one('bookings', { _id: booking._id });
  assert.equal(approved.status, 'awaiting_payment');
  assert.equal(+approved.hold_expires_at, +approved.payment_deadline_at);
  assert.equal(+new Date(decision.paymentDeadline) - +approved.review_info.reviewed_at, 900000);
  await repo.insert('discount_codes', {
    _id: oid(),
    code: 'RENTER10',
    is_active: true,
    discount_type: 'percentage',
    discount_value: 10,
    usage_limit: 1,
    used_count: 0,
    expiry_date: new Date(+end + 86400000)
  });
  assert.equal((await service.voucher(user, String(booking._id), {
    code: 'RENTER10'
  })).rental_fee_amount, 1260000);
  await assert.rejects(service.pay(user, String(booking._id), {
    agree_deposit: true,
    payment_method: 'VNPAY_QR'
  }), {
    status: 409
  });
  const prepared = await contractRequest(`/contracts/rental/prepare/${booking._id}`, operation, {});
  const sign = { signatureName: 'Người ký kiểm thử', documentHash: prepared.document.hash, acceptedTerms: true };
  await contractRequest(`/contracts/rental/${prepared.id}/sign`, user, sign);
  await assert.rejects(service.pay(user, String(booking._id), { agree_deposit: true, payment_method: 'VNPAY_QR' }), { status: 409 });
  await contractRequest(`/contracts/rental/${prepared.id}/sign?view=staff`, operation, sign, 403);
  await contractRequest(`/contracts/rental/${prepared.id}/sign?view=staff`, manager, sign);
  const a = await repo.one('rental_agreements', {
    booking_id: booking._id
  });
  assert.equal(a.status, 'signed');
  assert.equal(a.terms_snapshot.rental_fee_amount, 1260000);
  assert.equal(String(a.signing_info.platform_signer_user_id), String(manager._id));
  const payments = await Promise.all([service.pay(user, String(booking._id), {
    agree_deposit: true,
    payment_method: 'VNPAY_QR'
  }), service.pay(user, String(booking._id), {
    agree_deposit: true,
    payment_method: 'VNPAY_QR'
  })]);
  assert.equal(payments.length, 2);
  assert.equal(await repo.count('payment_transactions', {
    booking_id: booking._id
  }), 2);
  assert.equal((await repo.one('security_deposits', {
    booking_id: booking._id
  })).collected_amount, 3000000);
});
test('renter payment creates all prerequisites expected by garage pickup', async () => {
  const context = await createGarageHandoverService(createGarageHandoverRepository(db)).context(booking._id, 'pickup');
  assert.deepEqual(context.blockers, []);
  assert.equal(context.eligible, true);
  const result = await service.bookings(user, {
    status: 'active',
    q: 'TEST-RENTER'
  });
  assert.equal(result.pagination.total, 1);
  assert.equal((await service.bookings(user, {
    q: '['
  })).pagination.total, 0);
});
test('cancellation uses snapshotted policy and never claims an actual refund', async () => {
  const preview = await service.cancelPreview(user, String(booking._id));
  assert.equal(preview.refund_amount, 1260000);
  await repo.update('platform_policies', {
    policy_type: 'cancellation',
    status: 'active'
  }, {
    $set: {
      'config.free_cancel_before_hours': 9999
    }
  });
  const cancelled = await service.cancel(user, String(booking._id), {
    reason: 'CHANGE_OF_PLAN',
    agreed: true
  });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellation_info.refund_amount, 1260000);
  assert.equal(cancelled.cancellation_info.refund_status, 'requested');
  assert.equal(await repo.count('payment_transactions', {
    booking_id: booking._id,
    transaction_type: 'rental_refund'
  }), 0);
  assert.equal((await service.cancel(user, String(booking._id), {
    reason: 'CHANGE_OF_PLAN',
    agreed: true
  })).status, 'cancelled');
});
test('paid renter trip progresses through Garage pickup and return with customer receipts', async () => {
  const trip = (await service.createBooking(user, payload('full-rental-trip'))).booking;
  const staff = async (code) => {
    const role = await repo.one('roles', { code });
    return repo.one('users', { primary_role_id: role._id, account_status: 'active' });
  };
  const operation = await staff('OPERATION_STAFF');
  const manager = await staff('MANAGER');
  const garage = await staff('GARAGE_STAFF');
  await contractRequest(`/operation/bookings/${trip._id}/decision`, operation, { action: 'approve' });
  const prepared = await contractRequest(`/contracts/rental/prepare/${trip._id}`, operation, {});
  const sign = { signatureName: 'Người ký kiểm thử', documentHash: prepared.document.hash, acceptedTerms: true };
  await contractRequest(`/contracts/rental/${prepared.id}/sign`, user, sign);
  await contractRequest(`/contracts/rental/${prepared.id}/sign?view=staff`, manager, sign);
  await service.pay(user, String(trip._id), { agree_deposit: true, payment_method: 'VNPAY_QR' });
  const handover = createGarageHandoverService(createGarageHandoverRepository(db));
  const condition = { exterior: 'good', interior: 'good', engine: 'good', tires: 'good' };
  const pickup = await handover.create({
    booking_id: trip._id, handover_type: 'pickup', odometer_km: 10000, fuel_level_pct: 80, vehicle_condition: condition,
  }, garage);
  await handover.confirm(pickup._id, { version: pickup.version, renterConfirmed: true }, garage);
  const ongoing = await service.detail(user, String(trip._id));
  assert.equal(ongoing.booking.status, 'ongoing');
  assert.equal(ongoing.handovers.pickup.odometer_km, 10000);
  const returned = await handover.create({
    booking_id: trip._id, handover_type: 'return', odometer_km: 10150, fuel_level_pct: 80, vehicle_condition: condition,
  }, garage);
  await handover.confirm(returned._id, { version: returned.version, renterConfirmed: true }, garage);
  const finished = await service.detail(user, String(trip._id));
  assert.equal(finished.booking.status, 'completed');
  assert.equal(finished.handovers.return.odometer_km, 10150);
  assert.equal(finished.deposit.refunded_amount, 0);
});

test('incident requires owned ongoing trip, pickup ODO, GPS and owned evidence', async () => {
  const trip = (await service.createBooking(user, payload('incident-trip'))).booking;
  const a = oid(),
    b = oid();
  for (const _id of [a, b]) await repo.insert('renter_files', {
    _id,
    owner_id: user._id,
    purpose: 'incident',
    content_type: 'image/png'
  });
  const body = {
    booking_id: String(trip._id),
    case_type: 'TIRE_PUNCTURE',
    description: 'Lốp trước bị thủng khi đang đi trên đường.',
    latitude: 21.0,
    longitude: 105.0,
    odometer_km: 101,
    evidence: [String(a), String(b)]
  };
  await assert.rejects(service.report(user, body), {
    status: 409
  });
  await repo.update('bookings', {
    _id: trip._id
  }, {
    $set: {
      status: 'ongoing'
    }
  });
  await repo.insert('rental_handovers', {
    _id: oid(),
    booking_id: trip._id,
    vehicle_id: trip.vehicle_id,
    handover_type: 'pickup',
    status: 'confirmed',
    odometer_km: 100
  });
  await assert.rejects(service.report(user, {
    ...body,
    odometer_km: 99
  }), {
    status: 400
  });
  await assert.rejects(service.report(other, body), {
    status: 404
  });
  const incident = await service.report(user, body);
  assert.equal(incident.status, 'reported');
  assert.equal(incident.evidence.length, 2);
  assert.equal((await service.incidents(other)).some(i => String(i._id) === String(incident._id)), false);
});
test('private uploads stay owned, registration uses one-use OTP and strong password', async () => {
  const bytes = Buffer.alloc(100 * 1024, 1);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  const file = await service.upload(user, {
    purpose: 'identity',
    name: 'test.png',
    content_type: 'image/png',
    data: bytes.toString('base64')
  });
  assert.deepEqual((await service.download(user, String(file._id))).bytes, bytes);
  await assert.rejects(service.download(other, String(file._id)), {
    status: 404
  });
  const c = {
      email: 'new-renter@example.com',
      phone: '0933333333'
    },
    otp = await service.challenge(null, {
      ...c,
      purpose: 'register'
    });
  const body = {
    ...c,
    full_name: 'Khách Mới',
    password: 'Renter123!',
    confirm_password: 'Renter123!',
    agree_terms: true,
    challenge_id: String(otp.challenge_id),
    otp: otp.demo_code
  };
  await assert.rejects(service.register({
    ...body,
    password: '123456',
    confirm_password: '123456'
  }), {
    status: 400
  });
  const created = await service.register(body);
  assert.equal(created.password_hash, undefined);
  assert.equal(created.identity_kyc.status, 'unverified');
  await assert.rejects(service.register(body), {
    status: 400
  });
});
