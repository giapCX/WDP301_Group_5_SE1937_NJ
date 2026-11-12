import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf, integer } from './schema.js';

const { ObjectId } = Schema.Types;

export const vehicleWithdrawalRequestSchema = createSchema({
  vehicle_id: { type: ObjectId, ref: 'Vehicle', required: true },
  owner_id: { type: ObjectId, ref: 'User', required: true },
  management_agreement_id: { type: ObjectId, ref: 'ManagementAgreement' },
  assigned_operation_staff_id: { type: ObjectId, ref: 'User' },
  request_type: String,
  reason: String,
  requested_return_at: Date,
  requested_at: Date,
  affected_bookings: arrayOf(embedded({
    booking_id: { type: ObjectId, ref: 'Booking' },
    arrangement: String,
  })),
  termination_notice: embedded({
    legal_effective_at: Date,
    notice_method: String,
    status: String,
  }),
  final_settlement: embedded({
    status: String,
    amount_due: Number,
  }),
  owner_return_handover: embedded({
    garage_staff_id: { type: ObjectId, ref: 'User' },
    returned_at: Date,
    odometer_km: integer({ min: 0, max: 10000000 }),
    fuel_level_pct: integer({ min: 0, max: 100 }),
    photo_keys: arrayOf(String),
    owner_confirmed_at: Date,
    version: Number,
    intake_id: { type: ObjectId, ref: 'VehicleIntake' },
    condition: embedded({
      exterior: String, interior: String, engine: String, tires: String, note: String,
      accessories: arrayOf(String), photo_keys: arrayOf(String),
      defects: arrayOf(embedded({ code: String, location: String, description: String, severity: String, photo_key: String })),
    }),
    damage_changes: arrayOf(embedded({ code: String, change: String })),
    owner_response: String,
    owner_note: String,
  }),
  status: String,
  completed_at: Date,
  created_at: Date,
});
