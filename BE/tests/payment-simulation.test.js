const { test } = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../src/repositories/booking.repository');
const reservations = require('../src/repositories/renter-reservation.repository');
const { Booking, Payment } = require('../src/models');

test('simulation records failures for retry, cancels only on explicit cancellation and checks ownership', async (context) => {
  context.mock.method(repository, 'runInTransaction', async (action) => action(null));
  context.mock.method(reservations, 'nextIds', async () => 1);
  // Load after transaction helpers are stubbed: no database or payment provider is used.
  const payments = require('../src/services/renter-payment.service');
  const previousEnv = process.env.NODE_ENV;
  const previousMode = process.env.PAYMENT_MODE;
  process.env.NODE_ENV = 'development';
  process.env.PAYMENT_MODE = 'simulation';
  context.after(() => {
    if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
    if (previousMode === undefined) delete process.env.PAYMENT_MODE; else process.env.PAYMENT_MODE = previousMode;
  });
  let booking;
  const rows = [];
  function reset() {
    booking = { booking_id: 7, renter_id: 9, booking_status: 'awaiting_payment', paid_total: 0,
      quote_offer: { accepted_at: new Date() }, pricing_breakdown: { total: 1000000 }, deposit_due: 300000,
      checkout_attempt: { id: 'test-attempt', amount: 300000, purpose: 'deposit' } };
  }
  context.mock.method(Booking, 'findOne', (filter) => {
    const found = Object.entries(filter).every(([key, value]) => {
      if (key === 'checkout_attempt.id') return booking.checkout_attempt?.id === value;
      return booking[key] === value;
    });
    const query = { session: () => query, lean: async () => found ? structuredClone(booking) : null };
    return query;
  });
  context.mock.method(Booking, 'updateOne', async (filter, update) => {
    if (filter['checkout_attempt.id'] !== booking.checkout_attempt?.id) return { modifiedCount: 0 };
    if (update.$inc) booking.paid_total += update.$inc.paid_total;
    for (const [key, value] of Object.entries(update.$set || {})) {
      const [field, nested] = key.split('.');
      if (nested) booking[field][nested] = value;
      else booking[field] = value;
    }
    for (const key of Object.keys(update.$unset || {})) delete booking[key];
    return { modifiedCount: 1 };
  });
  context.mock.method(Payment, 'create', async (documents) => rows.push(...documents));
  reset();
  await assert.rejects(payments.simulate(7, 10, { attemptId: 'test-attempt', outcome: 'success' }), { statusCode: 409 });
  assert.equal(booking.paid_total, 0);
  await payments.simulate(7, 9, { attemptId: 'test-attempt', outcome: 'success' });
  assert.equal(booking.paid_total, 300000);
  assert.equal(booking.booking_status, 'confirmed');
  assert.equal(rows[0].payment_method, 'simulation');
  assert.equal(rows[0].purpose, 'deposit');
  await assert.rejects(payments.simulate(7, 9, { attemptId: 'test-attempt', outcome: 'success' }), { statusCode: 409 });
  assert.equal(rows.length, 1);
  reset();
  await payments.simulate(7, 9, { attemptId: 'test-attempt', outcome: 'failed' });
  assert.equal(booking.paid_total, 0);
  assert.equal(booking.booking_status, 'awaiting_payment');
  assert.ok(booking.checkout_failed_at);
  assert.equal(rows[1].payment_status, 'failed');
  reset();
  await payments.simulate(7, 9, { attemptId: 'test-attempt', outcome: 'cancelled' });
  assert.equal(booking.paid_total, 0);
  assert.equal(booking.booking_status, 'awaiting_payment');
  assert.equal(rows.length, 2);
  reset();
  booking.transport_contract = { status: 'signed_pending_payment', id: 'signed-contract' };
  const failed = await payments.simulate(7, 9, { attemptId: 'test-attempt', outcome: 'failed' });
  assert.equal(failed.contractCancelled, false);
  assert.equal(booking.booking_status, 'awaiting_payment');
  assert.equal(booking.transport_contract.status, 'signed_pending_payment');
  assert.equal(booking.checkout_attempt, undefined);
  assert.deepEqual(payments.paymentDue(booking), { purpose: 'deposit', amount: 300000 });

  reset();
  booking.transport_contract = { status: 'signed_pending_payment', id: 'signed-contract' };
  const cancelled = await payments.simulate(7, 9, { attemptId: 'test-attempt', outcome: 'cancelled' });
  assert.equal(cancelled.contractCancelled, true);
  assert.equal(booking.booking_status, 'cancelled');
  assert.equal(booking.transport_contract.status, 'cancelled');
  assert.equal(booking.transport_contract.cancellationReason, 'payment_cancelled');
  assert.ok(booking.transport_contract.cancelledAt instanceof Date);
  assert.equal(booking.transport_contract.id, 'signed-contract');
  assert.equal(booking.paid_total, 0);
  assert.equal(booking.checkout_attempt, undefined);
  assert.equal(payments.paymentDue(booking), null);
  await assert.rejects(payments.checkout(7, 9), { statusCode: 409 });
  await assert.rejects(payments.simulate(7, 9, { attemptId: 'test-attempt', outcome: 'success' }), { statusCode: 409 });
  assert.equal(rows.length, 3);
  assert.equal(rows.at(-1).payment_status, 'failed');
  reset();
  booking.booking_status = 'completed';
  booking.paid_total = 300000;
  booking.checkout_attempt = { id: 'balance-attempt', amount: 700000, purpose: 'balance' };
  await payments.simulate(7, 9, { attemptId: 'balance-attempt', outcome: 'success' });
  assert.equal(booking.paid_total, 1000000);
  assert.equal(booking.booking_status, 'completed');
  assert.equal(payments.paymentDue(booking), null);
  reset();
  booking.booking_status = 'completed';
  booking.transport_contract = { status: 'active', id: 'signed-contract' };
  booking.paid_total = 300000;
  booking.checkout_attempt = { id: 'balance-attempt', amount: 700000, purpose: 'balance' };
  const cancelledBalance = await payments.simulate(7, 9, { attemptId: 'balance-attempt', outcome: 'cancelled' });
  assert.equal(cancelledBalance.contractCancelled, true);
  assert.equal(booking.booking_status, 'completed');
  assert.equal(booking.transport_contract.status, 'cancelled');
  assert.equal(booking.transport_contract.cancellationReason, 'payment_cancelled');
  assert.equal(booking.paid_total, 300000);
  assert.equal(payments.paymentDue(booking), null);
  await assert.rejects(payments.checkout(7, 9), { statusCode: 409 });
  await assert.rejects(payments.simulate(7, 9, { attemptId: 'balance-attempt', outcome: 'success' }), { statusCode: 409 });
  reset();
  booking.deposit_due = 350000;
  await assert.rejects(payments.simulate(7, 9, { attemptId: 'test-attempt', outcome: 'success' }), { statusCode: 409 });
  assert.equal(booking.paid_total, 0);
  process.env.NODE_ENV = 'production';
  assert.equal(payments.isSimulated(), false);
  await assert.rejects(payments.simulate(7, 9, { attemptId: 'x', outcome: 'success' }), { statusCode: 404 });
});
