import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf } from './schema.js';

const { ObjectId } = Schema.Types;

export const securityDepositSchema = createSchema({
  booking_id: { type: ObjectId, ref: 'Booking', required: true },
  collection_payment_id: { type: ObjectId, ref: 'PaymentTransaction' },
  required_amount: Number,
  collected_amount: Number,
  deducted_amount: Number,
  refunded_amount: Number,
  refundable_amount: Number,
  movements: arrayOf(embedded({
    type: String,
    amount: Number,
    transaction_id: { type: ObjectId, ref: 'PaymentTransaction' },
    at: Date,
    incident_case_id: { type: ObjectId, ref: 'IncidentCase' },
  })),
  deduction_decisions: arrayOf(embedded({
    incident_case_id: { type: ObjectId, ref: 'IncidentCase' },
    amount: Number,
    status: String,
    approved_by_user_id: ObjectId,
    renter_response: String,
    contract_basis: String,
  })),
  status: String,
  refund_due_at: Date,
  updated_at: Date,
});
