const { createModel } = require('./model-factory');

module.exports = createModel(
  'Review',
  'reviews',
  {
    review_id: {
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
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    renter_id: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    driver_rating: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    service_rating: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    comment: {
      type: String,
      default: null,
    },
    created_at: {
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
      name: 'renter',
      model: 'User',
      localField: 'renter_id',
      foreignField: 'user_id',
    },
  ],
);
