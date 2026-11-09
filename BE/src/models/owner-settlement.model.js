import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf } from './schema.js';

const { ObjectId } = Schema.Types;

export const ownerSettlementSchema = createSchema({
  owner_id: { type: ObjectId, ref: 'User', required: true },
  vehicle_id: { type: ObjectId, ref: 'Vehicle' },
  management_agreement_id: { type: ObjectId, ref: 'ManagementAgreement' },
  period_start: Date,
  period_end: Date,
  items: arrayOf(embedded({
    booking_id: { type: ObjectId, ref: 'Booking' },
    rental_revenue: Number,
    commission_pct: Number,
    platform_commission: Number,
  })),
  gross_rental_revenue: Number,
  platform_commission: Number,
  other_adjustments: Number,
  net_owner_payout: Number,
  payout_transaction_id: { type: ObjectId, ref: 'PaymentTransaction' },
  payout_status: String,
  settled_at: Date,
  created_at: Date,
});
