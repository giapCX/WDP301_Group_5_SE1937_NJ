const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const data = require('../src/config/sample-data');
const { router, attachUser } = require('../src/routes/auth.routes');
const chargeRoutes = require('../src/routes/additional-charge.routes');
const historyRoutes = require('../src/routes/renter-booking-change.routes');
const overviewRoutes = require('../src/routes/operator-overview.routes');
const errors = require('../middlewares/error.middleware');

test('merged session auth interoperates with Operator and Renter business APIs', async () => {
  const dbName = `merged_auth_test_${process.pid}_${Date.now()}`;
  await mongoose.connect(
    process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27018/?replicaSet=rentalLocal',
    { dbName, autoIndex: false },
  );
  let server;
  try {
    for (const [name, rows] of Object.entries(data))
      await mongoose.connection.db.collection(name).insertMany(rows);
    const app = express();
    app.use(express.json());
    app.use('/api/auth', router);
    app.use(attachUser);
    app.use('/api/operator/additional-charges', chargeRoutes.operatorChargeRoutes);
    app.use('/api/renter/bookings', historyRoutes);
    app.use('/api/operator', overviewRoutes);
    app.use(errors);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    async function login(email) {
      const result = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password: 'Demo@12345' }),
      });
      assert.equal(result.status, 200);
      return {
        cookie: result.headers.get('set-cookie').split(';')[0],
        user: (await result.json()).user,
      };
    }
    const operator = await login('demo3@example.com');
    assert.equal(operator.user.role_name, 'operator');
    assert.equal(
      (
        await fetch(base + '/api/operator/additional-charges', {
          headers: { Cookie: operator.cookie },
        })
      ).status,
      200,
    );
    const overview = await fetch(base + '/api/operator/dashboard', {
      headers: { Cookie: operator.cookie },
    });
    assert.equal(overview.status, 200);
    assert.equal((await overview.json()).data.totalBookings, 6);
    const vehicles = await fetch(base + '/api/operator/vehicles/available', {
      headers: { Cookie: operator.cookie },
    });
    assert.equal(vehicles.status, 200);
    assert.equal((await vehicles.json()).data.items.length, 3);
    assert.equal((await fetch(base + '/api/operator/dashboard')).status, 401);
    const renter = await login('demo8@example.com');
    assert.equal(
      (
        await fetch(base + '/api/operator/dashboard', {
          headers: { Cookie: renter.cookie },
        })
      ).status,
      403,
    );
    assert.equal(renter.user.user_id, 8);
    const history = await fetch(base + '/api/renter/bookings/2/change-requests', {
      headers: { Cookie: renter.cookie },
    });
    assert.equal(history.status, 200);
    assert.equal((await history.json()).data.total, 3);
    assert.equal(
      (
        await fetch(base + '/api/operator/additional-charges', {
          headers: { Cookie: renter.cookie },
        })
      ).status,
      403,
    );
    await fetch(base + '/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: renter.cookie },
    });
    assert.equal(
      (
        await fetch(base + '/api/renter/bookings/2/change-requests', {
          headers: { Cookie: renter.cookie },
        })
      ).status,
      401,
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.db?.databaseName === dbName)
      await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
