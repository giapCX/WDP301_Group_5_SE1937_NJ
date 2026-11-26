const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const models = require('../src/models');
const data = require('../src/config/sample-data');
const routes = require('../src/routes/renter-booking-change.routes');
const errors = require('../middlewares/error.middleware');
const { connectTestDatabase } = require('./helpers/test-database');

test('renter history HTTP enforces ownership, filters and ten-row pagination', async () => {
  const dbName = `renter_history_test_${process.pid}_${Date.now()}`;
  await connectTestDatabase(mongoose, dbName, {
    autoIndex: false,
  });
  let server;
  try {
    await models.Booking.insertMany(data.bookings);
    await models.BookingChangeRequest.insertMany(data.booking_change_requests);
    let user;
    const app = express();
    app.use((req, res, next) => {
      req.user = user;
      next();
    });
    app.use('/api/renter/bookings', routes);
    app.use(errors);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    async function get(id = 2, query = '', status = 200) {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/api/renter/bookings/${id}/change-requests${query}`,
      );
      assert.equal(response.status, status);
      return response.json();
    }
    await get(2, '', 401);
    user = { user_id: 3, role_name: 'operator', status: 'active' };
    await get(2, '', 403);
    user = { user_id: 7, role_name: 'renter', status: 'active' };
    await get(2, '?requested_by=8', 403);
    user = { user_id: 8, role_name: 'renter', status: 'disabled' };
    await get(2, '', 403);
    user = { user_id: 8, role_name: 'renter', status: 'active' };
    const all = await get();
    assert.equal(all.data.total, 3);
    assert.equal(all.data.limit, 10);
    assert.deepEqual(
      all.data.items.map((item) => item.change_request_id),
      [3, 2, 1],
    );
    assert.ok(all.data.items[0].before);
    assert.ok(all.data.items[0].after);
    assert.ok(all.data.items[2].rejection_reason);
    assert.equal(JSON.stringify(all).includes('password_hash'), false);
    assert.equal(JSON.stringify(all).includes('email'), false);
    assert.equal((await get(2, '?status=pending')).data.total, 1);
    const page = await get(2, '?page=2&limit=2');
    assert.equal(page.data.items.length, 1);
    assert.equal(page.data.total_pages, 2);
    assert.equal((await get(5)).data.total, 0);
    await get(999, '', 404);
    await get('abc', '', 400);
    for (const query of [
      '?limit=11',
      '?page=0',
      '?status=confirmed',
      '?page=1e2',
      '?limit=',
      '?status=pending&status=approved',
    ])
      await get(2, query, 400);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.db?.databaseName === dbName)
      await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
