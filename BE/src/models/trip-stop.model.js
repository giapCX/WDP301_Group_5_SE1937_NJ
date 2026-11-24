const { createModel } = require('./model-factory');

module.exports = createModel(
  'TripStop',
  'trip_stops',
  {
    stop_id: {
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
    stop_order: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    location: {
      type: String,
      required: true,
      maxlength: 255,
    },
    note: {
      type: String,
      default: null,
      maxlength: 255,
    },
    arrival_at: Date,
    departure_at: Date,
  },
  [
    {
      name: 'booking',
      model: 'Booking',
      localField: 'booking_id',
      foreignField: 'booking_id',
    },
  ],
  [
    {
      fields: { booking_id: 1, stop_order: 1 },
      options: { unique: true },
    },
  ],
);
