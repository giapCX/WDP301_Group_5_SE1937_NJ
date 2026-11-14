import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf } from './schema.js';
import { contractDocument } from './contract-document.js';

const { ObjectId } = Schema.Types;

export const rentalAgreementSchema = createSchema({
  booking_id: { type: ObjectId, ref: 'Booking', required: true },
  management_agreement_id: { type: ObjectId, ref: 'ManagementAgreement' },
  contract_number: { type: String, required: true },
  lender_details_snapshot: embedded({
    owner_id: { type: ObjectId, ref: 'User' },
    platform_representative_user_id: ObjectId,
    authority_agreement_number: String,
    authority_signed_at: Date,
  }),
  renter_details_snapshot: embedded({
    renter_id: { type: ObjectId, ref: 'User' },
    verified_license: Boolean,
    full_name: String,
  }),
  terms_snapshot: embedded({
    daily_rate: Number,
    rental_fee_amount: Number,
    deposit_amount: Number,
    start_at: Date,
    end_at: Date,
    signature_method: String,
    mileage_policy: Schema.Types.Mixed,
    rental_policy: Schema.Types.Mixed,
    cancellation: Schema.Types.Mixed,
    deposit_refund: Schema.Types.Mixed,
    discount_code: String,
    discount_amount: Number,
  }),
  signing_info: embedded({
    method: String,
    renter_confirmed: Boolean,
    platform_signer_user_id: ObjectId,
    renter_signer_user_id: ObjectId,
    renter_signature_name: String,
    renter_signed_at: Date,
    platform_signature_name: String,
    platform_signed_at: Date,
    terms_version: String,
  }),
  operator_intake: embedded({
    confirmed_by_operator_id: ObjectId,
    confirmed_at: Date,
  }),
  contract_document: contractDocument(),
  signed_document_key: String,
  amendments: arrayOf(embedded({ proposed_terms: Schema.Types.Mixed, reason: String, status: String, created_by_manager_id: ObjectId, created_at: Date })),
  manager_review: embedded({ status: String, note: String, reason: String, reviewed_by_manager_id: ObjectId, reviewed_at: Date }),
  updated_at: Date,
  status: String,
  signed_at: Date,
  created_at: Date,
});
