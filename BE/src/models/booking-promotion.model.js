const { createModel } = require('./model-factory');

module.exports = createModel(
  'BookingPromotion',
  'booking_promotions',
  {
    booking_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    promotion_id: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    discount_amount: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isFinite,
        message: 'Must be finite',
      },
      default: 0,
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
      name: 'promotion',
      model: 'Promotion',
      localField: 'promotion_id',
      foreignField: 'promotion_id',
    },
  ],
);
