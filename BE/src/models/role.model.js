import { createSchema, arrayOf } from './schema.js';

export const roleSchema = createSchema({
  code: { type: String, required: true },
  display_name: String,
  permissions: arrayOf(String),
  description: String,
  created_at: Date,
  updated_at: Date,
});
