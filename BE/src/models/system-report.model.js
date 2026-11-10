import { Schema } from 'mongoose';
import { createSchema } from './schema.js';

export const systemReportSchema = createSchema({
  report_type: { type: String, enum: ['finance', 'operations'], required: true },
  title: String,
  period_from: Date,
  period_to: Date,
  report_data: Schema.Types.Mixed,
  generated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  generated_at: Date,
});
