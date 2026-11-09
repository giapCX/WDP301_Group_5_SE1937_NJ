import { Schema } from 'mongoose';
import { createSchema, integer } from './schema.js';

const { ObjectId } = Schema.Types;

export const platformPolicySchema = createSchema({
  policy_type: { type: String, required: true },
  version: { ...integer({ min: 0 }), required: true },
  config: { type: Schema.Types.Mixed, required: true },
  effective_from: Date,
  effective_until: Date,
  updated_by_manager_id: { type: ObjectId, ref: 'User' },
  status: { type: String, enum: ["active", "superseded", "inactive"] },
  created_at: Date,
});
