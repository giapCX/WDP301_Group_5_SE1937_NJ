const { createModel } = require('./model-factory');

module.exports = createModel(
  'Payment',
  'payments',
  {
    payment_id: {
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
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isFinite,
        message: 'Must be finite',
      },
    },
    payment_method: {
      type: String,
      required: true,
      maxlength: 30,
    },
    payment_status: {
      type: String,
      required: true,
      maxlength: 30,
    },
    paid_at: {
      type: Date,
      default: null,
    },
  },
  [
    {
      name: 'booking',
      model: 'Booking',
      localField: 'booking_id',
      foreignField: 'booking_id',
    },
  ],
);
