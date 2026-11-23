const { createModel } = require('./model-factory');

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
        validator: Number.isFinite,
        message: 'Must be finite',
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
    status: {
      type: String,
      required: true,
      maxlength: 30,
    },
  },
  [],
);
