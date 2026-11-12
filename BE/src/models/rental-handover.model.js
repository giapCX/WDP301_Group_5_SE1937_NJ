import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf, integer } from './schema.js';

const { ObjectId } = Schema.Types;

export const rentalHandoverSchema = createSchema({
  booking_id: { type: ObjectId, ref: 'Booking', required: true },
  vehicle_id: { type: ObjectId, ref: 'Vehicle', required: true },
  garage_staff_id: { type: ObjectId, ref: 'User' },
  handover_type: { type: String, enum: ["pickup", "return"], required: true },
  occurred_at: Date,
  odometer_km: integer({ min: 0, max: 10000000 }),
  fuel_level_pct: integer({ min: 0, max: 100 }),
  vehicle_condition: embedded({
    exterior: String,
    interior: String,
    engine: String,
    tires: String,
    note: String,
    condition: String,
    photo_keys: arrayOf(String),
    accessories: arrayOf(String),
    defects: { type: [embedded({ code: String, location: String, description: String, severity: String, photo_key: String })], default: undefined },
    renter_signature_recorded: Boolean,
  }),
  renter_confirmed_at: Date,
  renter_response: String,
  renter_dispute_note: String,
  baseline_handover_id: ObjectId,
  damage_changes: { type: [embedded({ code: String, change: String })], default: undefined },
  calculated_surcharges: arrayOf(embedded({
    type: String,
    amount: Number,
    basis: String,
  })),
  status: String,
  version: integer({ min: 0 }),
  confirmed_from_version: integer({ min: 0 }),
  updated_at: Date,
  created_at: Date,
});
