import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf, integer } from './schema.js';

const { ObjectId } = Schema.Types;

export const vehicleIntakeSchema = createSchema({
  vehicle_id: { type: ObjectId, ref: 'Vehicle', required: true },
  management_agreement_id: { type: ObjectId, ref: 'ManagementAgreement', required: true },
  received_by_garage_staff_id: { type: ObjectId, ref: 'User' },
  received_at: Date,
  owner_confirmed_at: Date,
  owner_review: embedded({ status: String, note: String, reviewed_at: Date, owner_id: ObjectId, reviewed_version: Number }),
  inspection_id: { type: ObjectId, ref: 'VehicleInspection' },
  odometer_km: integer({ min: 0, max: 10000000 }),
  fuel_level_pct: integer({ min: 0, max: 100 }),
  condition_snapshot: embedded({
    exterior: String,
    accessories: arrayOf(String),
    photo_keys: arrayOf(String),
    defects: { type: [embedded({ code: String, location: String, description: String, severity: String, photo_key: String })], default: undefined },
    owner_signature_recorded: Boolean,
    interior: String,
    engine: String,
    tires: String,
    note: String,
  }),
  intake_document_key: String,
  created_at: Date,
  status: { type: String, enum: ['draft', 'completed'] },
  version: integer({ min: 0 }),
  created_by_garage_staff_id: { type: ObjectId, ref: 'User' },
  confirmed_from_version: integer({ min: 0 }),
  updated_at: Date,
});
