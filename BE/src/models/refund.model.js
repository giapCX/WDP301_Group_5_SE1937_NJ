const { createModel } = require('./model-factory');

module.exports = createModel(
  'Refund',
  'refunds',
  {
    refund_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    payment_id: {
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
    reason: {
      type: String,
      default: null,
      maxlength: 255,
    },
    refund_status: {
      type: String,
      required: true,
      maxlength: 30,
    },
    approved_by: {
      type: Number,
      default: null,
      validate: {
        validator: (value) => value === null || Number.isSafeInteger(value),
        message: 'Must be a safe integer',
      },
    },
  },
  [
    {
      name: 'payment',
      model: 'Payment',
      localField: 'payment_id',
      foreignField: 'payment_id',
    },
    {
      name: 'approved_user',
      model: 'User',
      localField: 'approved_by',
      foreignField: 'user_id',
    },
  ],
);
