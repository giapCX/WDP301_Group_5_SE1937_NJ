import { Schema } from 'mongoose';
import { createSchema, embedded, arrayOf } from './schema.js';

const { ObjectId } = Schema.Types;

export const userSchema = createSchema({
  full_name: String,
  email: { type: String, required: true },
  phone: String,
  password_hash: String,
  primary_role_id: { type: ObjectId, ref: 'Role' },
  additional_role_ids: arrayOf({ type: ObjectId, ref: 'Role' }),
  account_status: { type: String, enum: ["active", "suspended", "pending", "inactive", "locked"], required: true },
  identity_kyc: embedded({
    status: String,
    id_masked: String,
    verified_at: Date,
    evidence_key: String,
  }),
  driver_license: embedded({
    class: String,
    license_masked: String,
    expires_at: Date,
    verification_status: String,
    evidence_key: String,
  }),
  contact_profile: embedded({
    city: String,
    avatar_key: String,
  }),
  payout_profile: embedded({
    bank_name: String,
    account_token: String,
    account_masked: String,
  }),
  created_at: Date,
  updated_at: Date,
});
