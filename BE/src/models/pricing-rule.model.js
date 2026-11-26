const { createModel } = require('./model-factory');
const { SERVICE_TYPES, PRICING_STATUSES } = require('../config/pricing.constants');

module.exports = createModel(
  'PricingRule',
  'pricing_rules',
  {
    rule_id: { type: Number, required: true, unique: true, validate: Number.isSafeInteger },
    name: { type: String, required: true, maxlength: 120 },
    service_type: { type: String, required: true, enum: Object.values(SERVICE_TYPES) },
    seat_count: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    km_rate: { type: Number, min: 0, validate: Number.isSafeInteger },
    dispatch_percent: { type: Number, min: 0, max: 100 },
    day_rate: { type: Number, min: 0, validate: Number.isSafeInteger },
    included_km_per_day: { type: Number, min: 0, validate: Number.isSafeInteger },
    extra_km_rate: { type: Number, min: 0, validate: Number.isSafeInteger },
    driver_night_rate: { type: Number, min: 0, validate: Number.isSafeInteger },
    route: { type: String, default: '', maxlength: 200 },
    status: { type: String, required: true, enum: Object.values(PRICING_STATUSES) },
    created_by: Number,
    created_at: { type: Date, required: true },
    updated_at: { type: Date, required: true },
  },
  [],
  [{
    fields: { service_type: 1, seat_count: 1 },
    options: {
      name: 'one_active_pricing_rule_per_service_and_capacity',
      unique: true,
      partialFilterExpression: { status: 'active' },
    },
  }],
);
