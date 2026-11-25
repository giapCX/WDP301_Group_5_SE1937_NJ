const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cancellationPrice } = require('../src/services/cancellation.service');
const { paymentDue } = require('../src/services/renter-payment.service');
const { validateTimes } = require('../src/utils/itinerary-snapshot');
const booking = { booking_status: 'confirmed', paid_total: 300000, refunded_total: 0,
  pickup_time: new Date('2027-01-05T00:00:00Z'), estimated_price: 1000000 };
test('cancellation uses request-time threshold and does not invent a missing policy', () => {
  assert.throws(() => cancellationPrice(booking, null), { statusCode: 409 });
  const policy = { policy_id: 1, name: 'Policy', cancellation_fee_percent: 10, free_cancellation_hours: 48 };
  assert.equal(cancellationPrice(booking, policy, new Date('2027-01-02T00:00:00Z')).fee, 0);
  assert.equal(cancellationPrice(booking, policy, new Date('2027-01-04T00:00:00Z')).fee, 100000);
  assert.equal(cancellationPrice(booking, { ...policy, free_cancellation_hours: 0 }, new Date('2027-01-02T00:00:00Z')).fee, 100000);
});
test('cancellation cannot refund more than unrefunded payments', () => {
  const value = cancellationPrice({ ...booking, refunded_total: 150000 }, { cancellation_fee_percent: 10 });
  assert.equal(value.refund_amount, 50000);
  assert.throws(() => cancellationPrice(booking, { cancellation_fee_percent: 101 }), { statusCode: 409 });
});
test('balance deducts compensation refunds and stops collection during a dispute', () => {
  const value = { booking_status: 'completed', quote_offer: { accepted_at: new Date() }, pricing_breakdown: { total: 1000000 },
    paid_total: 300000, refunded_total: 100000, compensation_refunded: 100000, additional_charge: 0 };
  assert.equal(paymentDue(value).amount, 700000);
  assert.equal(paymentDue({ ...value, additional_charges: [{ status: 'disputed' }] }), null);
});
test('itinerary validation preserves roundtrip return and chronological tour stops', () => {
  const value = { pickup_time: new Date('2027-01-01T01:00:00Z'), estimated_end_time: new Date('2027-01-02T12:00:00Z'),
    destination: 'A', return_pickup_location: 'B', return_pickup_time: '2027-01-02T05:00:00Z', trip_stops: [] };
  assert.doesNotThrow(() => validateTimes(value, 'roundtrip'));
  assert.throws(() => validateTimes({ ...value, return_pickup_time: null }, 'roundtrip'), { statusCode: 400 });
  assert.throws(() => validateTimes({ ...value, trip_stops: [{ arrival_at: '2027-01-01T05:00:00Z', departure_at: '2027-01-01T04:00:00Z' }] }, 'tour'), { statusCode: 400 });
});
