import { Schema } from 'mongoose';
import { createSchema, embedded } from './schema.js';

const { ObjectId } = Schema.Types;

export const managementAgreementSchema = createSchema({
  vehicle_id: { type: ObjectId, ref: 'Vehicle', required: true },
  owner_id: { type: ObjectId, ref: 'User', required: true },
  platform_signer_id: { type: ObjectId, ref: 'User' },
  agreement_number: { type: String, required: true },
  start_date: Date,
  end_date: Date,
  commission_rate_pct: Number,
  authorization_scope: embedded({
    rental_contract_signing: Boolean,
    vehicle_custody: Boolean,
    listing_management: Boolean,
    booking_management: Boolean,
    owner_confirmation_per_booking: Boolean,
    commission_basis: String,
  }),
  signature_info: embedded({
    method: String,
    owner_signed_at: Date,
    platform_signed_at: Date,
    owner_signature_name: String,
    terms_version: String,
  }),
  signed_document_key: String,
  status: String,
  termination_info: embedded({
    legal_effective_at: Date,
    reason: String,
    notice_method: String,
  }),
  created_at: Date,
  updated_at: Date,
});
