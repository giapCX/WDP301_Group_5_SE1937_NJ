const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const { Booking } = require('../src/models');
const data = require('../src/config/sample-data');
const service = require('../src/services/additional-charge.service');
const bookingRepository = require('../src/repositories/booking.repository');
const routes = require('../src/routes/additional-charge.routes');
const errors = require('../middlewares/error.middleware');
const { connectTestDatabase } = require('./helpers/test-database');

test('embedded charge lifecycle keeps totals and history atomic without a new collection', async () => {
  const dbName = `charges_test_${process.pid}_${Date.now()}`;
  await connectTestDatabase(mongoose, dbName, {
    dbName,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
  });
  let server;
  try {
    await Booking.insertMany(data.bookings);
    const payload = {
      type: 'waiting',
      description: 'Chờ khách 2 giờ',
      quantity: 2,
      unit_price: 100000,
      amount: 1,
      status: 'confirmed',
      created_by: 999,
      evidence: ['https://example.com/demo.jpg'],
    };
    const created = await service.mutate('create', 4, null, payload, 3);
    const chargeId = created.charge.charge_id;
    assert.equal(
      'additional_charges' in (await bookingRepository.findBookingById(4)),
      false,
    );
    assert.equal(created.charge.status, 'draft');
    assert.equal(created.charge.amount, 200000);
    assert.equal(created.charge.created_by, 3);
    assert.equal(created.additional_charge, 200000); // legacy aggregate retained
    await assert.rejects(service.mutate('create', 1, null, payload, 3), {
      statusCode: 409,
    });
    for (const invalid of [
      { ...payload, quantity: -1 },
      { ...payload, unit_price: 0 },
      { ...payload, quantity: '2' },
      { ...payload, evidence: ['javascript:alert(1)'] },
      null,
    ]) {
      await assert.rejects(service.mutate('create', 4, null, invalid, 3), {
        statusCode: 400,
      });
    }
    const decisions = await Promise.allSettled([
      service.mutate('confirm', 4, chargeId, { reason: 'Đối soát' }, 3),
      service.mutate('confirm', 4, chargeId, { reason: 'Đối soát lần 2' }, 3),
    ]);
    assert.equal(decisions.filter((value) => value.status === 'fulfilled').length, 1);
    assert.equal(
      decisions.find((value) => value.status === 'rejected').reason.statusCode,
      409,
    );
    assert.equal((await Booking.findOne({ booking_id: 4 })).additional_charge, 400000);
    await assert.rejects(
      service.mutate('update', 4, chargeId, { ...payload, reason: 'Sửa' }, 3),
      { statusCode: 409 },
    );
    await assert.rejects(
      service.mutate('dispute', 4, chargeId, { reason: 'Không đồng ý' }, 8),
      { statusCode: 403 },
    );
    const disputed = await service.mutate(
      'dispute',
      4,
      chargeId,
      { reason: 'Không chờ lâu như vậy', evidence: [] },
      7,
    );
    assert.equal(disputed.additional_charge, 400000);
    assert.equal(disputed.charge.status, 'disputed');
    await assert.rejects(service.mutate('cancel', 4, chargeId, { reason: 'Hủy' }, 3), {
      statusCode: 409,
    });
    const resolved = await service.mutate(
      'resolve',
      4,
      chargeId,
      { resolution: 'waive', reason: 'Chấp nhận phản ánh' },
      3,
    );
    assert.equal(resolved.additional_charge, 200000);
    assert.equal(resolved.charge.history.length, 4);
    await assert.rejects(
      service.mutate('resolve', 4, chargeId, { resolution: 'waive', reason: 'Retry' }, 3),
      { statusCode: 409 },
    );
    const second = await service.mutate('create', 4, null, payload, 3);
    const edited = await service.mutate(
      'update',
      4,
      second.charge.charge_id,
      { ...payload, quantity: 1, reason: 'Điều chỉnh số giờ' },
      3,
    );
    assert.equal(edited.charge.amount, 100000);
    await service.mutate('confirm', 4, second.charge.charge_id, { reason: 'Hợp lệ' }, 3);
    await service.mutate(
      'dispute',
      4,
      second.charge.charge_id,
      { reason: 'Kiểm tra lại' },
      7,
    );
    const upheld = await service.mutate(
      'resolve',
      4,
      second.charge.charge_id,
      { resolution: 'uphold', reason: 'Có bằng chứng' },
      3,
    );
    assert.equal(upheld.additional_charge, 300000);
    await service.mutate(
      'cancel',
      4,
      second.charge.charge_id,
      { reason: 'Miễn phí hỗ trợ khách' },
      3,
    );
    assert.equal((await Booking.findOne({ booking_id: 4 })).additional_charge, 200000);
    assert.equal(
      (await service.list({ status: 'cancelled', type: 'waiting' }, 4, 7)).total,
      2,
    );
    assert.equal((await service.list({ page: 2, limit: 1 }, 4)).items.length, 1);
    await assert.rejects(service.list({ limit: 11 }, 4), { statusCode: 400 });
    await assert.rejects(service.detail(4, chargeId, 8), { statusCode: 403 });
    await assert.rejects(service.detail(4, 999), { statusCode: 404 });
    assert.equal((await service.list({}, 2, 8)).total, 0);
    assert.equal(
      (await mongoose.connection.db.listCollections().toArray()).some(
        (item) => item.name === 'additional_charges',
      ),
      false,
    );

    let user;
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = user;
      next();
    });
    app.use('/api/operator/bookings', routes.operatorBookingRoutes);
    app.use('/api/operator/additional-charges', routes.operatorChargeRoutes);
    app.use('/api/renter/bookings', routes.renterBookingRoutes);
    app.use(errors);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/operator/additional-charges`)).status, 401);
    user = { user_id: 7, role_name: 'renter', status: 'active' };
    assert.equal((await fetch(`${base}/api/operator/additional-charges`)).status, 403);
    assert.equal(
      (await fetch(`${base}/api/renter/bookings/4/additional-charges`)).status,
      200,
    );
    assert.equal(
      (await fetch(`${base}/api/renter/bookings/2/additional-charges`)).status,
      403,
    );
    user = { user_id: 3, role_name: 'operator', status: 'active' };
    const response = await fetch(`${base}/api/operator/bookings/4/additional-charges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 201);
    const charge = (await response.json()).data.charge;
    assert.equal(
      (
        await fetch(
          `${base}/api/operator/bookings/4/additional-charges/${charge.charge_id}`,
        )
      ).status,
      200,
    );
    assert.equal(
      (await fetch(`${base}/api/operator/additional-charges?type=waiting&status=draft`))
        .status,
      200,
    );
    const confirmed = await fetch(
      `${base}/api/operator/bookings/4/additional-charges/${charge.charge_id}/confirm`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Xác nhận' }),
      },
    );
    assert.equal(confirmed.status, 200);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.db?.databaseName === dbName)
      await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
