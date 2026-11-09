import { Schema } from 'mongoose';
import { createSchema, embedded } from './schema.js';

const { ObjectId } = Schema.Types;

export const rentalAgreementSchema = createSchema({
  booking_id: { type: ObjectId, ref: 'Booking', required: true },
  management_agreement_id: { type: ObjectId, ref: 'ManagementAgreement' },
  contract_number: { type: String, required: true },
  lender_details_snapshot: embedded({
    owner_id: { type: ObjectId, ref: 'User' },
    platform_representative_user_id: ObjectId,
    authority_agreement_number: String,
  }),
  renter_details_snapshot: embedded({
    renter_id: { type: ObjectId, ref: 'User' },
    verified_license: Boolean,
  }),
  terms_snapshot: embedded({
    daily_rate: Number,
    rental_fee_amount: Number,
    deposit_amount: Number,
    start_at: Date,
    end_at: Date,
    signature_method: String,
  }),
  signing_info: embedded({
    method: String,
    renter_confirmed: Boolean,
    platform_signer_user_id: ObjectId,
  }),
  signed_document_key: String,
  status: String,
  signed_at: Date,
  created_at: Date,
});
