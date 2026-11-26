const { Schema } = require('mongoose');
const { CANCELLATION_STATUSES } = require('../config/workflow.constants');
const historySchema = new Schema({
  action: { type: String, required: true }, actor_id: { type: Number, required: true },
  at: { type: Date, required: true }, note: { type: String, maxlength: 2000 },
}, { _id: false });
const approvalSchema = new Schema({
  id: String, status: { type: String, enum: CANCELLATION_STATUSES },
  action: { type: String, enum: ['support', 'compensation', 'replace_vehicle', 'replace_driver', 'change_itinerary'] },
  note: { type: String, maxlength: 2000 }, amount: { type: Number, min: 0, validate: Number.isSafeInteger },
  requested_by: Number, requested_at: Date, reviewed_by: Number, reviewed_at: Date, decision_note: String,
}, { _id: false });
module.exports = { historySchema, approvalSchema };
