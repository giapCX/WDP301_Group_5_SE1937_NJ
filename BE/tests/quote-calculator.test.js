const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateQuote } = require('../src/services/quote-calculator');
const common = { tolls: 400000, parking: 0, otherFee: 0, adjustment: 0, reason: '' };
test('roundtrip matches 4,720,000 reference example without overnight charges', () => {
  const result = calculateQuote('roundtrip', { ...common, outwardKm: 150, returnKm: 150, kmRate: 12000, dispatchPercent: 20 });
  assert.equal(result.subtotal, 4720000);
});
test('tour matches 7,290,000 reference and counts overtime per day', () => {
  const input = { ...common, parking: 150000, dayRate: 1500000, totalKm: 420, kmRate: 12000,
    dailyHours: [8, 10, 8], hourRate: 100000, nights: 2, nightRate: 300000 };
  assert.equal(calculateQuote('tour', input).subtotal, 7290000);
  assert.equal(calculateQuote('tour', { ...input, dailyHours: [6, 10, 8] }).subtotal, 7290000);
});
test('reject invalid values, missing adjustment reasons and negative totals', () => {
  const input = { ...common, outwardKm: 150, returnKm: 150, kmRate: 12000, dispatchPercent: 20 };
  for (const change of [{ outwardKm: -1 }, { kmRate: NaN }, { dispatchPercent: 101 },
    { adjustment: -100 }, { otherFee: 100 }, { adjustment: -999999999, reason: 'Giảm giá' }]) {
    assert.throws(() => calculateQuote('roundtrip', { ...input, ...change }), { statusCode: 400 });
  }
  assert.equal(calculateQuote('roundtrip', { ...input, adjustment: -100000, reason: 'Điều chỉnh tuyến' }).subtotal, 4620000);
});

test('preview checks workflow and uses the booking service type', async (context) => {
  const { Booking } = require('../src/models');
  const { previewQuote } = require('../src/services/booking-quote.service');
  let booking = { service_type: 'roundtrip', quote_requested_at: new Date(), booking_status: 'pending' };
  context.mock.method(Booking, 'findOne', () => ({ lean: async () => booking }));
  const calculation = { ...common, outwardKm: 150, returnKm: 150, kmRate: 12000, dispatchPercent: 20 };
  assert.equal((await previewQuote(1, { calculation, subtotal: 1 })).subtotal, 4720000);
  booking.booking_status = 'confirmed';
  await assert.rejects(previewQuote(1, { calculation }), { statusCode: 409 });
  booking = null;
  await assert.rejects(previewQuote(1, { calculation }), { statusCode: 404 });
});
test('booking schema preserves calculation inputs and line items', async () => {
  const { Booking } = require('../src/models');
  const calculation = calculateQuote('roundtrip', { ...common, outwardKm: 150, returnKm: 150, kmRate: 12000, dispatchPercent: 20 });
  const booking = new Booking({ booking_id: 1, renter_id: 7, pickup_location: 'A', dropoff_location: 'B',
    pickup_time: new Date(), estimated_end_time: new Date(), created_at: new Date(), booking_status: 'quoted',
    quote_calculation: calculation });
  await booking.validate();
  assert.deepEqual(booking.toObject().quote_calculation.inputs, calculation.inputs);
  assert.deepEqual(booking.toObject().quote_calculation.lines, calculation.lines);
});
