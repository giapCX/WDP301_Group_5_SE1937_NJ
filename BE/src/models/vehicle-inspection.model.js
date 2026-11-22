const { createModel } = require('./model-factory');

module.exports = createModel(
  'VehicleInspection',
  'vehicle_inspections',
  {
    inspection_id: {
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
    booking_id: {
      type: Number,
      default: null,
      validate: {
        validator: (value) => value === null || Number.isSafeInteger(value),
        message: 'Must be a safe integer',
      },
    },
    staff_id: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    inspection_type: {
      type: String,
      required: true,
      maxlength: 30,
    },
    condition_note: {
      type: String,
      default: null,
    },
    result: {
      type: String,
      required: true,
      maxlength: 30,
    },
    inspected_at: {
      type: Date,
      required: true,
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
      name: 'booking',
      model: 'Booking',
      localField: 'booking_id',
      foreignField: 'booking_id',
    },
    {
      name: 'staff',
      model: 'User',
      localField: 'staff_id',
      foreignField: 'user_id',
    },
  ],
);
