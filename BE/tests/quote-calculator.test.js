const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateQuote } = require('../src/services/quote-calculator');

const roundtrip = { service_type: 'roundtrip', requested_seats: 7 };
const roundtripRule = { rule_id: 3, name: 'Khứ hồi · 7 chỗ', service_type: 'roundtrip', seat_count: 7,
  km_rate: 12000, dispatch_percent: 20, status: 'active', updated_at: new Date('2026-11-01T00:00:00Z') };
const roundtripInput = { outwardKm: 150, returnKm: 150 };

test('roundtrip uses configured database rates and returns immutable quote snapshot', () => {
  const result = calculateQuote(roundtrip, roundtripInput, roundtripRule);
  assert.equal(result.subtotal, 4320000);
  assert.equal(result.lines.length, 3);
  assert.equal(result.pricing_rule.rule_id, roundtripRule.rule_id);
  assert.equal(result.pricing_rule.km_rate, roundtripRule.km_rate);
});

test('tour uses day, included distance, overage and overnight rates from pricing rule', () => {
  const booking = { service_type: 'tour', requested_seats: 4,
    pickup_time: '2026-11-25T18:00:00Z', estimated_end_time: '2026-11-28T10:00:00Z' };
  const rule = { rule_id: 2, name: 'Tour · 4 chỗ', service_type: 'tour', seat_count: 4,
    day_rate: 1200000, included_km_per_day: 100, extra_km_rate: 10000, driver_night_rate: 80000,
    updated_at: new Date('2026-11-01T00:00:00Z') };
  const result = calculateQuote(booking, { totalKm: 420, nights: 2 }, rule);
  assert.equal(result.subtotal, 4960000);
  assert.equal(result.inputs.rentalDays, 3);
  assert.equal(result.lines.length, 3);
  assert.throws(() => calculateQuote(booking, { totalKm: 420, nights: 3 }, rule), { statusCode: 400 });
  assert.throws(() => calculateQuote({ ...booking, estimated_end_time: null }, { totalKm: 420, nights: 2 }, rule), { statusCode: 400 });
});

test('rejects invalid input and rules that do not match booking service or seat count', () => {
  for (const change of [{ outwardKm: -1 }, { outwardKm: Number.NaN }]) {
    assert.throws(() => calculateQuote(roundtrip, { ...roundtripInput, ...change }, roundtripRule), { statusCode: 400 });
  }
  assert.throws(() => calculateQuote(roundtrip, roundtripInput, { ...roundtripRule, seat_count: 4 }), { statusCode: 409 });
  assert.throws(() => calculateQuote(roundtrip, roundtripInput, { ...roundtripRule, dispatch_percent: 101 }), { statusCode: 409 });
});

test('booking schema preserves calculation inputs, line items and pricing snapshot', async () => {
  const { Booking } = require('../src/models');
  const calculation = calculateQuote(roundtrip, roundtripInput, roundtripRule);
  const booking = new Booking({ booking_id: 1, renter_id: 7, pickup_location: 'A', dropoff_location: 'B',
    pickup_time: new Date(), estimated_end_time: new Date(), created_at: new Date(), booking_status: 'quoted',
    quote_calculation: calculation });
  await booking.validate();
  assert.deepEqual(booking.toObject().quote_calculation.inputs, calculation.inputs);
  assert.deepEqual(booking.toObject().quote_calculation.lines, calculation.lines);
  assert.equal(booking.toObject().quote_calculation.pricing_rule.rule_id, roundtripRule.rule_id);
});
