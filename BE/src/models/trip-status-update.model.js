const { createModel } = require('./model-factory');

module.exports = createModel(
  'TripStatusUpdate',
  'trip_status_updates',
  {
    update_id: {
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
    updated_by: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    trip_status: {
      type: String,
      required: true,
      maxlength: 30,
    },
    updated_at: {
      type: Date,
      required: true,
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
      name: 'updated_user',
      model: 'User',
      localField: 'updated_by',
      foreignField: 'user_id',
    },
  ],
);
