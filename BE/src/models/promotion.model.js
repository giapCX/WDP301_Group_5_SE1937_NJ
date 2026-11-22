const { createModel } = require('./model-factory');

module.exports = createModel(
  'Promotion',
  'promotions',
  {
    promotion_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    code: {
      type: String,
      required: true,
      unique: true,
      maxlength: 40,
    },
    discount_percent: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isFinite,
        message: 'Must be finite',
      },
    },
    valid_until: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      maxlength: 20,
    },
  },
  [],
);
