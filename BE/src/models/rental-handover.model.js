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
    renter_signature_recorded: Boolean,
  }),
  renter_confirmed_at: Date,
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
