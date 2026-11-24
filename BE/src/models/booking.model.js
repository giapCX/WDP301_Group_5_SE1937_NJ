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
    service_type: { type: String, enum: ['roundtrip', 'tour'] },
    passenger_count: { type: Number, min: 1 },
    requested_seats: { type: Number, min: 1, validate: Number.isSafeInteger },
    destination: { type: String, maxlength: 255 },
    return_pickup_location: { type: String, maxlength: 255 },
    return_pickup_time: Date,
    special_requests: { type: String, maxlength: 1000 },
    terms_accepted_at: Date,
    terms_version: String,
    renter_request_id: String,
    checkout_attempt: { id: String, expiresAt: Number, sessionId: String, amount: Number, purpose: String },
    checkout_failed_at: Date,
    quote_requested_at: Date,
    quote_offer: { id: String, sent_at: Date, sent_by: Number, accepted_at: Date, promotion_id: Number, promotion_code: String },
    requested_promotion_code: String,
    deposit_due: Number,
    deposit_paid_at: Date,
    paid_total: Number,
    pricing_breakdown: {
      subtotal: Number, surcharge: Number, discount: Number, total: Number,
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
  [
    { fields: { renter_id: 1, renter_request_id: 1 }, options: {
      unique: true, partialFilterExpression: { renter_request_id: { $type: 'string' } },
    } },
  ],
);
