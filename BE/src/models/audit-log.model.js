import { Schema } from 'mongoose';
import { createSchema } from './schema.js';

const { ObjectId } = Schema.Types;

export const auditLogSchema = createSchema({
  actor_user_id: { type: ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entity_type: { type: String, required: true },
  entity_id: { type: ObjectId, required() { return this.entity_type !== 'authentication'; } },
  sanitized_changes: Schema.Types.Mixed,
  ip_address_masked: String,
  created_at: Date,
});
