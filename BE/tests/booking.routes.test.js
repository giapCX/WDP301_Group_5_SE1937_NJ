const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bookingRoutes = require('../src/routes/booking.routes');
const service = require('../src/services/booking.service');
const HttpError = require('../src/utils/http-error');
const errorMiddleware = require('../middlewares/error.middleware');

test('booking decision routes enforce access and forward authenticated reviewer', async (context) => {
  let user;
  const app = express();
  app.use(express.json());
  // Test fixture only: production must obtain req.user from verified authentication.
  app.use((req, res, next) => {
    req.user = user;
    next();
  });
  app.use('/api/operator/bookings', bookingRoutes);
  app.use(errorMiddleware);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/operator/bookings`;
  const approve = context.mock.method(service, 'approveBooking', async () => ({
    booking_id: 1,
    booking_status: 'confirmed',
  }));
  const reject = context.mock.method(service, 'rejectBooking', async () => ({
    booking_id: 1,
    booking_status: 'rejected',
  }));

  async function patch(action, body = {}) {
    return fetch(`${base}/1/${action}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  for (const action of ['approve', 'reject']) {
    assert.equal((await patch(action, { reviewed_by: 3 })).status, 401);
    user = { user_id: 7, role_name: 'renter', status: 'active' };
    assert.equal((await patch(action)).status, 403);
    user = { user_id: 3, role_name: 'operator', status: 'disabled' };
    assert.equal((await patch(action)).status, 403);
    user = undefined;
  }
  assert.equal(approve.mock.callCount(), 0);
  assert.equal(reject.mock.callCount(), 0);

  user = { user_id: 3, role_name: 'operator', status: 'active' };
  const approvalBody = { vehicle_id: 2, reviewed_by: 999 };
  const approval = await patch('approve', approvalBody);
  assert.equal(approval.status, 200);
  assert.equal((await approval.json()).data.booking_status, 'confirmed');
  assert.deepEqual(approve.mock.calls[0].arguments, ['1', approvalBody, 3]);

  const rejectionBody = { rejection_reason: 'Khong du xe' };
  const rejection = await patch('reject', rejectionBody);
  assert.equal(rejection.status, 200);
  assert.equal((await rejection.json()).success, true);
  assert.deepEqual(reject.mock.calls[0].arguments, ['1', rejectionBody, 3]);

  for (const statusCode of [400, 404, 409]) {
    approve.mock.mockImplementation(async () => {
      throw new HttpError(statusCode, 'Decision failed');
    });
    const response = await patch('approve');
    assert.equal(response.status, statusCode);
    assert.deepEqual(await response.json(), {
      success: false,
      message: 'Decision failed',
    });
  }
});
