import { Schema } from 'mongoose';
import { createSchema } from './schema.js';

const { ObjectId } = Schema.Types;

export const paymentTransactionSchema = createSchema({
  booking_id: { type: ObjectId, ref: 'Booking' },
  initiator_user_id: { type: ObjectId, ref: 'User' },
  transaction_type: String,
  direction: String,
  amount: { type: Number, required: true },
  currency: String,
  payment_method: String,
  provider: String,
  provider_transaction_id: String,
  related_transaction_id: { type: ObjectId, ref: 'PaymentTransaction' },
  idempotency_key: { type: String, required: true },
  status: String,
  provider_response: Schema.Types.Mixed,
  paid_at: Date,
  created_at: Date,
});
