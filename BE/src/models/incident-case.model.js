import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf } from './schema.js';

const { ObjectId } = Schema.Types;

export const incidentCaseSchema = createSchema({
  case_number: { type: String, required: true },
  reported_by_user_id: { type: ObjectId, ref: 'User' },
  assigned_operation_staff_id: { type: ObjectId, ref: 'User' },
  reviewed_by_manager_id: { type: ObjectId, ref: 'User' },
  vehicle_id: { type: ObjectId, ref: 'Vehicle', required: true },
  booking_id: { type: ObjectId, ref: 'Booking' },
  case_type: String,
  incident_type: String,
  location: embedded({ latitude: Number, longitude: Number }),
  odometer_km: Number,
  severity: { type: String, enum: ['low', 'medium', 'high'] },
  source_handover_id: { type: ObjectId, ref: 'RentalHandover' },
  request_key: String,
  request_fingerprint: String,
  description: { type: String, required: true },
  evidence: arrayOf(embedded({
    kind: String,
    file_key: String,
    uploaded_by_user_id: { type: ObjectId, ref: 'User' },
  })),
  investigation: embedded({
    review_status: String,
    renter_response: String,
  }),
  traffic_violation_details: embedded({
    reported_at: Date,
    notice_number: String,
    official_confirmation: String,
    fine_amount_claimed: Number,
  }),
  compensation_claims: arrayOf(embedded({
    requested_amount: Number,
    proposed_amount: Number,
    approved_amount: Number,
    decision: String,
    decision_at: Date,
    reviewed_by_manager_id: { type: ObjectId, ref: 'User' },
    renter_response: String,
    evidence_basis: String,
    manager_note: String,
  })),
  resolution: embedded({
    outcome: String,
    amount: Number,
    resolved_at: Date,
    note: String,
  }),
  status: String,
  created_at: Date,
  updated_at: Date,
});
