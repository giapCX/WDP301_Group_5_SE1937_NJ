const assert = require('node:assert/strict');
const { test } = require('node:test');
const { paymentDue } = require('../src/services/renter-payment.service');

test('accepted quote charges the deposit first and deducts both payments and quoted fees from the balance', () => {
  const booking = {
    quote_offer: { accepted_at: new Date() },
    pricing_breakdown: { total: 4720000, surcharge: 400000 },
    deposit_due: 1416000,
    additional_charge: 500000,
    paid_total: 1416000,
  };
  assert.equal(paymentDue({ ...booking, booking_status: 'quoted' }), null);
  assert.deepEqual(paymentDue({ ...booking, booking_status: 'awaiting_payment' }), { purpose: 'deposit', amount: 1416000 });
  assert.equal(paymentDue({ ...booking, booking_status: 'confirmed' }), null);
  assert.deepEqual(paymentDue({ ...booking, booking_status: 'completed' }), { purpose: 'balance', amount: 3404000 });
  assert.equal(paymentDue({ ...booking, booking_status: 'completed', paid_total: 4820000 }), null);
});

