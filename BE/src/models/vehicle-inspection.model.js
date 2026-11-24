const { Schema } = require('mongoose');
const { createModel } = require('./model-factory');
const { CHECKLIST_ITEMS } = require('../utils/garage-inspection-details');

const checklistSchema = new Schema(Object.fromEntries(CHECKLIST_ITEMS.map((item) => [
  item, { type: String, enum: ['passed', 'failed'], required: true },
])), { _id: false });

const photoSchema = new Schema({
  content_type: { type: String, enum: ['image/jpeg', 'image/png'], required: true },
  data: { type: Buffer, required: true },
}, { _id: false });

module.exports = createModel(
  'VehicleInspection',
  'vehicle_inspections',
  {
    inspection_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    vehicle_id: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    booking_id: {
      type: Number,
      default: null,
      validate: {
        validator: (value) => value === null || Number.isSafeInteger(value),
        message: 'Must be a safe integer',
      },
    },
    staff_id: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    inspection_type: {
      type: String,
      required: true,
      maxlength: 30,
    },
    condition_note: {
      type: String,
      default: null,
    },
    result: {
      type: String,
      required: true,
      maxlength: 30,
    },
    odometer: {
      type: Number,
      default: null,
      min: 0,
      validate: { validator: (value) => value === null || Number.isFinite(value), message: 'Must be a finite number' },
    },
    checklist: { type: checklistSchema },
    fuel_percent: { type: Number, min: 0, max: 100, validate: Number.isInteger },
    photos: { type: [photoSchema], default: undefined, select: false },
    photo_count: { type: Number, default: 0 },
    inspected_at: {
      type: Date,
      required: true,
    },
  },
  [
    {
      name: 'vehicle',
      model: 'Vehicle',
      localField: 'vehicle_id',
      foreignField: 'vehicle_id',
    },
    {
      name: 'booking',
      model: 'Booking',
      localField: 'booking_id',
      foreignField: 'booking_id',
    },
    {
      name: 'staff',
      model: 'User',
      localField: 'staff_id',
      foreignField: 'user_id',
    },
  ],
);
