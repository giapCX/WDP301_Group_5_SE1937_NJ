const { additionalChargeSchema } = require('./additional-charge.schema');
const { createModel } = require('./model-factory');
const { BOOKING_STATUSES, CANCELLATION_STATUSES } = require('../config/workflow.constants');

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
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer VND amount',
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
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer VND amount',
      },
      default: 0,
    },
    booking_status: {
      type: String,
      required: true,
      enum: BOOKING_STATUSES,
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
    cancellation: {
      id: String, status: { type: String, enum: CANCELLATION_STATUSES },
      reason: String, requested_by: Number, requested_at: Date, reviewed_by: Number, reviewed_at: Date,
      decision_note: String, fee: { type: Number, validate: Number.isSafeInteger }, original_fee: { type: Number, validate: Number.isSafeInteger }, refund_amount: { type: Number, validate: Number.isSafeInteger },
      policy: { policy_id: Number, name: String, fee_percent: Number, free_hours: Number, hours_before: Number, effective_from: Date, effective_to: Date },
    },
    compensation_refunded: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    refunded_total: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    operation_events: { type: [require('./operation.schema').historySchema], default: [] },
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
    checkout_attempt: { id: String, expiresAt: Number, sessionId: String, amount: { type: Number, validate: Number.isSafeInteger }, purpose: String },
    checkout_failed_at: Date,
    quote_requested_at: Date,
    quote_offer: { id: String, sent_at: Date, sent_by: Number, accepted_at: Date },
    deposit_due: { type: Number, validate: Number.isSafeInteger },
    deposit_paid_at: Date,
    paid_total: { type: Number, validate: Number.isSafeInteger },
    transport_contract: { type: require('mongoose').Schema.Types.Mixed },
    quote_calculation: {
      inputs: { type: require('mongoose').Schema.Types.Mixed },
      lines: [{ _id: false, label: String, quantity: Number, unit_price: { type: Number, validate: Number.isSafeInteger }, amount: { type: Number, validate: Number.isSafeInteger } }],
      subtotal: { type: Number, validate: Number.isSafeInteger },
      pricing_rule: {
        rule_id: Number,
        name: String,
        service_type: String,
        seat_count: Number,
        updated_at: Date,
        km_rate: Number,
        dispatch_percent: Number,
        day_rate: Number,
        included_km_per_day: Number,
        extra_km_rate: Number,
        driver_night_rate: Number,
      },
    },
    pricing_breakdown: {
      subtotal: { type: Number, validate: Number.isSafeInteger }, surcharge: { type: Number, validate: Number.isSafeInteger },
      total: { type: Number, validate: Number.isSafeInteger },
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
