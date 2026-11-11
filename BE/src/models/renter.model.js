import { Schema } from 'mongoose';
import { createSchema } from './schema.js';

const { ObjectId, Mixed, Buffer: BufferType } = Schema.Types;

export const renterChallengeSchema = createSchema({
  actor: String,
  purpose: String,
  target: Mixed,
  code_hash: String,
  attempts: Number,
  used: Boolean,
  created_at: Date,
  expires_at: Date,
});

export const renterFileSchema = createSchema({
  owner_id: { type: ObjectId, ref: 'User' },
  purpose: String,
  content_type: String,
  size: Number,
  name: String,
  created_at: Date,
});

export const renterFileChunkSchema = createSchema({
  file_id: { type: ObjectId, ref: 'RenterFile' },
  n: Number,
  data: BufferType,
});

export const renterContactKeySchema = createSchema({ _id: String });

export const discountCodeSchema = createSchema({
  code: String,
  is_active: Boolean,
  expiry_date: Date,
  starts_at: Date,
  min_order_value: Number,
  usage_limit: Number,
  used_count: Number,
  discount_type: String,
  discount_value: Number,
});
