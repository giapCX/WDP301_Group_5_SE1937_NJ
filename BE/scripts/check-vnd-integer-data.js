const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');

const MONEY_PATHS = Object.freeze({
  bookings: ['estimated_price', 'additional_charge', 'deposit_due', 'paid_total', 'compensation_refunded', 'refunded_total',
    'pricing_breakdown.subtotal', 'pricing_breakdown.surcharge', 'pricing_breakdown.total',
    'quote_calculation.subtotal', 'quote_calculation.lines.unit_price', 'quote_calculation.lines.amount',
    'additional_charges.unit_price', 'additional_charges.amount', 'operation_events.amount',
    'cancellation.fee', 'cancellation.original_fee', 'cancellation.refund_amount'],
  payments: ['amount'],
  refunds: ['amount'],
  vehicles: ['price_per_day'],
  booking_change_requests: ['before.estimated_price', 'after.estimated_price', 'price_difference'],
});

function valuesAtPath(document, pathValue) {
  return pathValue.split('.').reduce((value, key) => Array.isArray(value)
    ? value.flatMap((item) => item?.[key] ?? []) : value?.[key], document);
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const invalid = [];
  for (const [collectionName, paths] of Object.entries(MONEY_PATHS)) {
    for await (const document of db.collection(collectionName).find({}, { projection: { _id: 0 } })) {
      for (const pathValue of paths) {
        const values = valuesAtPath(document, pathValue);
        for (const value of Array.isArray(values) ? values : [values]) {
          if (value !== undefined && value !== null && !Number.isSafeInteger(value)) {
            invalid.push({ collection: collectionName, id: document.booking_id ?? document.payment_id ?? document.refund_id ?? document.vehicle_id ?? document.change_request_id, field: pathValue, value });
          }
        }
      }
    }
  }
  if (invalid.length) {
    console.error(JSON.stringify(invalid, null, 2));
    throw new Error(`Found ${invalid.length} monetary value(s) that are not safe integer VND. Review them before enabling stricter validation.`);
  }
  console.log('All checked monetary values are safe integer VND. No database changes made.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
