const mongoose = require('mongoose');
const { createModel } = require('./model-factory');
const { CHANGE_REQUEST_STATUSES } = require('../config/workflow.constants');

const stopSchema = new mongoose.Schema(
  {
    stop_order: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    location: { type: String, required: true, trim: true, maxlength: 255 },
    note: { type: String, default: null, maxlength: 255 },
    arrival_at: Date, departure_at: Date,
  },
  { _id: false },
);

// Full snapshots retain the itinerary that was reviewed, even after later changes.
const itinerarySchema = new mongoose.Schema(
  {
    pickup_location: { type: String, required: true, maxlength: 255 },
    dropoff_location: { type: String, required: true, maxlength: 255 },
    pickup_time: { type: Date, required: true },
    estimated_end_time: { type: Date, required: true },
    destination: String, return_pickup_location: String, return_pickup_time: Date,
    estimated_price: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    trip_stops: { type: [stopSchema], required: true, default: undefined },
  },
  { _id: false },
);

module.exports = createModel(
  'BookingChangeRequest',
  'booking_change_requests',
  {
    change_request_id: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    booking_id: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    requested_by: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    requested_at: { type: Date, required: true, default: Date.now },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    before: { type: itinerarySchema, required: true },
    after: { type: itinerarySchema, required: true },
    price_difference: { type: Number, required: true, validate: Number.isSafeInteger },
    request_status: {
      type: String,
      required: true,
      enum: CHANGE_REQUEST_STATUSES,
      default: 'pending',
    },
    price_offer: { id: String, sent_by: Number, sent_at: Date, reason: String, accepted_at: Date },
    reviewed_by: {
      type: Number,
      default: null,
      min: 1,
      validate: (value) => value === null || Number.isSafeInteger(value),
    },
    reviewed_at: { type: Date, default: null },
    rejection_reason: { type: String, trim: true, default: null, maxlength: 2000 },
  },
  [
    {
      name: 'booking',
      model: 'Booking',
      localField: 'booking_id',
      foreignField: 'booking_id',
    },
    {
      name: 'requester',
      model: 'User',
      localField: 'requested_by',
      foreignField: 'user_id',
    },
    {
      name: 'reviewer',
      model: 'User',
      localField: 'reviewed_by',
      foreignField: 'user_id',
    },
  ],
  [
    { fields: { request_status: 1, requested_at: -1 }, options: {} },
    { fields: { booking_id: 1, requested_at: -1 }, options: {} },
  ],
);
