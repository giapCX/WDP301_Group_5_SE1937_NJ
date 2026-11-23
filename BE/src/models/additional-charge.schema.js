const { Schema } = require('mongoose');

const CHARGE_TYPES = ['overtime', 'extra_km', 'waiting', 'other'];
const CHARGE_STATUSES = ['draft', 'confirmed', 'disputed', 'cancelled'];
const eventSchema = new Schema(
  {
    action: { type: String, required: true },
    actor_id: { type: Number, required: true },
    at: { type: Date, required: true },
    note: { type: String, required: true, maxlength: 2000 },
    type: { type: String, enum: CHARGE_TYPES, required: true },
    description: { type: String, required: true, maxlength: 2000 },
    quantity: { type: Number, required: true },
    unit_price: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: CHARGE_STATUSES, required: true },
    evidence: { type: [String], default: [] },
  },
  { _id: false },
);

const additionalChargeSchema = new Schema(
  {
    charge_id: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    type: { type: String, enum: CHARGE_TYPES, required: true },
    description: { type: String, required: true, maxlength: 2000 },
    quantity: { type: Number, required: true, min: 0.001 },
    unit_price: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    status: { type: String, enum: CHARGE_STATUSES, required: true, default: 'draft' },
    evidence: { type: [String], default: [] },
    created_by: { type: Number, required: true },
    created_at: { type: Date, required: true },
    updated_at: { type: Date, required: true },
    history: { type: [eventSchema], default: [] },
  },
  { _id: false },
);

module.exports = { additionalChargeSchema, CHARGE_TYPES, CHARGE_STATUSES };
