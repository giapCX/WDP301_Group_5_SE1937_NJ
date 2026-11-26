const { createModel } = require('./model-factory');
const { REFUND_STATUSES } = require('../config/workflow.constants');

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
    booking_id: Number,
    source_key: String,
    created_by: Number, created_at: Date, reviewed_at: Date, completed_at: Date,
    decision_note: String, provider_reference: String,
    history: { type: [require('./operation.schema').historySchema], default: [] },
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
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer VND amount',
      },
    },
    reason: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    refund_status: {
      type: String,
      required: true,
      enum: REFUND_STATUSES,
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
