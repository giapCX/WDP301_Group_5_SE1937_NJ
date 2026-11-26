const { createModel } = require('./model-factory');
const { PAYMENT_STATUSES } = require('../config/workflow.constants');

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
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer VND amount',
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
      enum: PAYMENT_STATUSES,
    },
    paid_at: {
      type: Date,
      default: null,
    },
    provider_reference: String,
    purpose: { type: String, enum: ['full', 'deposit', 'balance'] },
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
