import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf, integer } from './schema.js';

const { ObjectId } = Schema.Types;

export const vehicleInspectionSchema = createSchema({
  vehicle_id: { type: ObjectId, ref: 'Vehicle', required: true },
  garage_staff_id: { type: ObjectId, ref: 'User', required: true },
  reviewed_by_manager_id: { type: ObjectId, ref: 'User' },
  inspection_type: { type: String, enum: ["onboarding", "periodic", "return"], required: true },
  inspected_at: Date,
  condition_report: embedded({
    exterior: String,
    interior: String,
    engine: String,
    tires: String,
    odometer_km: integer({ min: 0, max: 10000000 }),
    fuel_level_pct: integer({ min: 0, max: 100 }),
    photo_keys: arrayOf(String),
    note: String,
    checklist: { type: [embedded({ key: String, result: String, note: String, photo_key: String })], default: undefined },
  }),
  recommendation: { type: String, enum: ["pass", "requires_repair", "fail"] },
  approval_status: { type: String, enum: ["draft", "pending", "approved", "revision_required", "rejected"], required: true },
  decision_reason: String,
  owner_review: embedded({ status: String, note: String, reviewed_at: Date, owner_id: ObjectId, reviewed_version: Number }),
  decided_at: Date,
  created_at: Date,
  version: integer({ min: 0 }),
  submitted_from_version: integer({ min: 0 }),
  submitted_at: Date,
  updated_at: Date,
  scheduled_for: Date,
  schedule_note: String,
  assigned_by_operation_staff_id: { type: ObjectId, ref: 'User' },
});
