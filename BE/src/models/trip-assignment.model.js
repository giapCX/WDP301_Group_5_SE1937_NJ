const { createModel } = require('./model-factory');

module.exports = createModel(
  'TripAssignment',
  'trip_assignments',
  {
    assignment_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    booking_id: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    driver_id: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    assigned_by: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    assigned_at: {
      type: Date,
      required: true,
    },
    assignment_status: {
      type: String,
      required: true,
      maxlength: 30,
    },
  },
  [
    {
      name: 'booking',
      model: 'Booking',
      localField: 'booking_id',
      foreignField: 'booking_id',
    },
    {
      name: 'driver',
      model: 'DriverProfile',
      localField: 'driver_id',
      foreignField: 'driver_id',
    },
    {
      name: 'assigned_user',
      model: 'User',
      localField: 'assigned_by',
      foreignField: 'user_id',
    },
  ],
);
