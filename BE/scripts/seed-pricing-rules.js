const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const marketPricing = require('../data/pricing-rules.json');
const { SERVICE_TYPES, PRICING_STATUSES } = require('../src/config/pricing.constants');

const SERVICE_TYPE_LIST = Object.values(SERVICE_TYPES);
const ACTIVE_STATUS = PRICING_STATUSES.ACTIVE;

function buildRules(startId, createdAt) {
  let ruleId = startId;
  return marketPricing.flatMap((pricing) => {
    const { seat_count, km_rate, dispatch_percent, day_rate, included_km_per_day, extra_km_rate, driver_night_rate } = pricing;
    return SERVICE_TYPE_LIST.map((service_type) => {
      const isTour = service_type === SERVICE_TYPES.TOUR;
      return {
        rule_id: ruleId++,
        name: `${service_type} · ${seat_count} chỗ`,
        service_type,
        seat_count,
        ...(isTour
          ? { day_rate, included_km_per_day, extra_km_rate, driver_night_rate }
          : { km_rate, dispatch_percent }),
        status: ACTIVE_STATUS,
        created_at: createdAt,
        updated_at: createdAt,
      };
    });
  });
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const collection = mongoose.connection.db.collection('pricing_rules');
  const now = new Date();
  const existing = await collection.find({}, { projection: { rule_id: 1, service_type: 1, seat_count: 1, status: 1 } }).toArray();
  const occupiedIds = new Set(existing.map(({ rule_id }) => rule_id));
  const activeKeys = new Set(existing
    .filter(({ status }) => status === ACTIVE_STATUS)
    .map(({ service_type, seat_count }) => `${service_type}:${seat_count}`));
  const nextId = Math.max(0, ...occupiedIds) + 1;
  const planned = buildRules(nextId, now).filter(({ service_type, seat_count }) => !activeKeys.has(`${service_type}:${seat_count}`));

  if (process.argv.includes('--check')) {
    console.table(planned.map(({ service_type, seat_count, rule_id }) => ({ service_type, seat_count, rule_id })));
    console.log(`Missing rules: ${planned.length}. No database changes.`);
    return;
  }
  if (!process.argv.includes('--apply')) throw new Error('Pass --check to preview or --apply to insert missing pricing rules.');

  const { PricingRule } = require('../src/models');
  for (const rule of planned) await new PricingRule(rule).validate();
  if (planned.length) await collection.insertMany(planned, { ordered: true });
  console.log(`Inserted ${planned.length} missing pricing rules into ${mongoose.connection.name}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
