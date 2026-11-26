const { createModel } = require('./model-factory');
const { VEHICLE_STATUSES } = require('../config/workflow.constants');

module.exports = createModel(
  'Vehicle',
  'vehicles',
  {
    vehicle_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    plate_number: {
      type: String,
      required: true,
      unique: true,
      maxlength: 20,
    },
    brand: {
      type: String,
      required: true,
      maxlength: 60,
    },
    model: {
      type: String,
      required: true,
      maxlength: 60,
    },
    photos: { type: [String], default: undefined },
    illustration_photos: { type: [String], default: undefined },
    seat_count: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    price_per_day: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer VND amount',
      },
    },
    schedule_version: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    schedule_lock_token: { type: String, default: null, select: false },
    schedule_lock_at: { type: Date, default: null, select: false },
    status: {
      type: String,
      required: true,
      enum: VEHICLE_STATUSES,
    },
  },
  [],
);
