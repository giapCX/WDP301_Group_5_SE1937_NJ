import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf, integer } from './schema.js';

const { ObjectId } = Schema.Types;

export const bookingSchema = createSchema({
  booking_code: { type: String, required: true },
  renter_id: { type: ObjectId, ref: 'User', required: true },
  vehicle_id: { type: ObjectId, ref: 'Vehicle', required: true },
  listing_id: { type: ObjectId, ref: 'VehicleListing' },
  management_agreement_id: { type: ObjectId, ref: 'ManagementAgreement' },
  start_at: { type: Date, required: true },
  end_at: { type: Date, required: true },
  actual_start_at: Date,
  actual_end_at: Date,
  pickup_location: embedded({
    branch: String,
  }),
  return_location: embedded({
    branch: String,
  }),
  rental_fee_amount: Number,
  deposit_amount_snapshot: Number,
  pricing_snapshot: embedded({
    daily_price: Number,
    charged_days: integer({ min: 0 }),
    currency: String,
    commission_rate_pct: Number,
    fuel_policy: String,
    late_fee_per_hour: Number,
  }),
  review_info: embedded({
    required: Boolean,
    decision: String,
    reviewed_by: ObjectId,
  }),
  cancellation_info: embedded({
    cancelled_by: { type: ObjectId, ref: 'User' },
    cancelled_at: Date,
    reason: String,
    refund_decision: String,
  }),
  status_history: arrayOf(embedded({
    from: String,
    to: String,
    at: Date,
    actor: String,
  })),
  status: { type: String, enum: ["pending", "awaiting_payment", "confirmed", "ongoing", "completed", "cancelled", "rejected", "expired"], required: true },
  created_at: Date,
  updated_at: Date,
  payment_deadline_at: Date,
  contract_workflow_version: integer({ min: 0 }),
});
