const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateQuote } = require('../src/services/quote-calculator');
const roundtrip = { service_type: 'roundtrip' };
const roundtripInput = { outwardKm: 150, returnKm: 150, kmRate: 12000, dispatchPercent: 20 };
test('roundtrip charges distance and dispatch only', () => {
  const result = calculateQuote(roundtrip, { ...roundtripInput, tolls: 400000, parking: 200000, otherFee: 100000, adjustment: 50000 });
  assert.equal(result.subtotal, 4320000);
  assert.equal(result.lines.length, 3);
});
test('tour derives rental days in Vietnam time and requires fewer nights than rental days', () => {
  const booking = { service_type: 'tour', pickup_time: '2026-11-25T18:00:00Z', estimated_end_time: '2026-11-28T10:00:00Z' };
  const input = { dayRate: 1500000, totalKm: 420, kmRate: 12000, nights: 2, nightRate: 300000, dailyHours: [24] };
  const result = calculateQuote(booking, input);
  assert.equal(result.subtotal, 6540000);
  assert.equal(result.inputs.rentalDays, 3);
  assert.equal(result.lines.length, 3);
  assert.throws(() => calculateQuote(booking, { ...input, nights: 3, rentalDays: 20 }), { statusCode: 400 });
  assert.throws(() => calculateQuote({ ...booking, estimated_end_time: null }, input), { statusCode: 400 });
});
test('rejects invalid distance, rates and dispatch percentage', () => {
  for (const change of [{ outwardKm: -1 }, { kmRate: NaN }, { dispatchPercent: 101 }]) {
    assert.throws(() => calculateQuote(roundtrip, { ...roundtripInput, ...change }), { statusCode: 400 });
  }
});

test('preview checks workflow and uses the booking service type', async (context) => {
  const { Booking } = require('../src/models');
  const { previewQuote } = require('../src/services/booking-quote.service');
  let booking = { service_type: 'roundtrip', quote_requested_at: new Date(), booking_status: 'pending' };
  context.mock.method(Booking, 'findOne', () => ({ lean: async () => booking }));
  const calculation = roundtripInput;
  assert.equal((await previewQuote(1, { calculation, subtotal: 1 })).subtotal, 4320000);
  booking.booking_status = 'confirmed';
  await assert.rejects(previewQuote(1, { calculation }), { statusCode: 409 });
  booking = null;
  await assert.rejects(previewQuote(1, { calculation }), { statusCode: 404 });
});
test('booking schema preserves calculation inputs and line items', async () => {
  const { Booking } = require('../src/models');
  const calculation = calculateQuote(roundtrip, roundtripInput);
  const booking = new Booking({ booking_id: 1, renter_id: 7, pickup_location: 'A', dropoff_location: 'B',
    pickup_time: new Date(), estimated_end_time: new Date(), created_at: new Date(), booking_status: 'quoted',
    quote_calculation: calculation });
  await booking.validate();
  assert.deepEqual(booking.toObject().quote_calculation.inputs, calculation.inputs);
  assert.deepEqual(booking.toObject().quote_calculation.lines, calculation.lines);
});
