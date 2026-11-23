const { createModel } = require('./model-factory');

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
