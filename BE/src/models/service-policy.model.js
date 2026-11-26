const { createModel } = require('./model-factory');
const { CONFIGURATION_STATUSES } = require('../config/workflow.constants');

module.exports = createModel(
  'ServicePolicy',
  'service_policies',
  {
    policy_id: { type: Number, required: true, unique: true, validate: Number.isSafeInteger },
    name: { type: String, required: true, maxlength: 120 },
    cancellation_fee_percent: { type: Number, required: true, min: 0, max: 100 },
    waiting_fee_per_hour: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    overtime_fee_per_hour: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    extra_km_fee: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    refund_days: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    free_cancellation_hours: { type: Number, default: 0, min: 0 },
    effective_from: { type: Date, required: true },
    effective_to: { type: Date, default: null },
    status: { type: String, required: true, enum: Object.values(CONFIGURATION_STATUSES) },
    created_by: Number,
    created_at: { type: Date, required: true },
    updated_at: { type: Date, required: true },
  },
  [],
  [{
    fields: { status: 1, effective_from: 1, effective_to: 1 },
    options: { name: 'service_policy_effectivity_lookup' },
  }],
);
