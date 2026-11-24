const { Schema } = require('mongoose');
const { createModel } = require('./model-factory');

const approvalSchema = new Schema({
  decision: { type: String, enum: ['approve', 'reject'], required: true },
  note: { type: String, maxlength: 1000 },
  manager_id: { type: Number, required: true },
  inspection_id: { type: Number, required: true },
  decided_at: { type: Date, required: true },
}, { _id: false });

module.exports = createModel(
  'MaintenanceRecord',
  'maintenance_records',
  {
    maintenance_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    vehicle_id: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    reported_by: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    description: {
      type: String,
      required: true,
    },
    maintenance_status: {
      type: String,
      required: true,
      maxlength: 30,
    },
    started_at: {
      type: Date,
      default: null,
    },
    completed_at: {
      type: Date,
      default: null,
    },
    repair_work: { type: String, maxlength: 1000 },
    repair_result: { type: String, maxlength: 1000 },
    repair_completed_at: { type: Date },
    repair_recorded_by: { type: Number },
    reinspection_id: { type: Number, default: null },
    requires_manager_approval: { type: Boolean, default: false },
    approvals: { type: [approvalSchema], default: undefined },
  },
  [
    {
      name: 'vehicle',
      model: 'Vehicle',
      localField: 'vehicle_id',
      foreignField: 'vehicle_id',
    },
    {
      name: 'reported_user',
      model: 'User',
      localField: 'reported_by',
      foreignField: 'user_id',
    },
  ],
);
