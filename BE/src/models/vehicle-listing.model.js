import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf } from './schema.js';

const { ObjectId } = Schema.Types;

export const vehicleListingSchema = createSchema({
  vehicle_id: { type: ObjectId, ref: 'Vehicle', required: true },
  created_by_operation_staff_id: { type: ObjectId, ref: 'User' },
  title: { type: String, required: true },
  description: String,
  photos: arrayOf(String),
  pickup_location: embedded({
    branch_name: String,
    city: String,
    address_label: String,
  }),
  daily_price: Number,
  security_deposit_amount: Number,
  mileage_policy: embedded({
    included_km_per_day: Number,
    extra_km_fee: Number,
  }),
  rental_policy_snapshot: embedded({
    late_fee_per_hour: Number,
    fuel_return_level: String,
    cancellation_policy_version: Number,
  }),
  availability_blocks: arrayOf(embedded({
    start_at: Date,
    end_at: Date,
    reason: String,
  })),
  status: String,
  created_at: Date,
  published_at: Date,
  updated_at: Date,
  updated_by_manager_id: { type: ObjectId, ref: 'User' },
  updated_by_operation_staff_id: { type: ObjectId, ref: 'User' },
  handled_by: { type: ObjectId, ref: 'User' },
  handled_at: Date,
  manager_review_note: String,
  operation_review_note: String,
});
