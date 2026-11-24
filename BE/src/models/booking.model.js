const { additionalChargeSchema } = require('./additional-charge.schema');
const { createModel } = require('./model-factory');

module.exports = createModel(
  'Booking',
  'bookings',
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
    renter_id: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    vehicle_id: {
      type: Number,
      default: null,
      validate: {
        validator: (value) => value === null || Number.isSafeInteger(value),
        message: 'Must be a safe integer',
      },
    },
    requested_seat_count: {
      type: Number,
      default: null,
      min: 1,
      validate: (value) => value === null || Number.isSafeInteger(value),
    },
    pickup_location: {
      type: String,
      required: true,
      maxlength: 255,
    },
    dropoff_location: {
      type: String,
      required: true,
      maxlength: 255,
    },
    pickup_time: {
      type: Date,
      required: true,
    },
    estimated_end_time: {
      type: Date,
      required: true,
    },
    estimated_price: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isFinite,
        message: 'Must be finite',
      },
      default: 0,
    },
    additional_charges: {
      type: [additionalChargeSchema],
      default: [],
    },
    additional_charge: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isFinite,
        message: 'Must be finite',
      },
      default: 0,
    },
    booking_status: {
      type: String,
      required: true,
      maxlength: 30,
    },
    created_at: {
      type: Date,
      required: true,
    },
    reviewed_by: {
      type: Number,
      default: null,
      validate: {
        validator: (value) => value === null || Number.isSafeInteger(value),
        message: 'Must be a safe integer',
      },
    },
    reviewed_at: {
      type: Date,
      default: null,
    },
    rejection_reason: {
      type: String,
      default: null,
    },
  },
  [
    {
      name: 'renter',
      model: 'User',
      localField: 'renter_id',
      foreignField: 'user_id',
    },
    {
      name: 'vehicle',
      model: 'Vehicle',
      localField: 'vehicle_id',
      foreignField: 'vehicle_id',
    },
    {
      name: 'reviewer',
      model: 'User',
      localField: 'reviewed_by',
      foreignField: 'user_id',
    },
  ],
);
