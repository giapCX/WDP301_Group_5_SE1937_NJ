const { createModel } = require('./model-factory');

module.exports = createModel(
  'Incident',
  'incidents',
  {
    incident_id: {
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
    reported_by: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    description: {
      type: String,
      required: true,
    },
    garage_damage_inspection_id: { type: Number },
    incident_status: {
      type: String,
      required: true,
      maxlength: 30,
    },
    resolution_note: {
      type: String,
      default: null,
    },
    resolved_by: {
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
      name: 'booking',
      model: 'Booking',
      localField: 'booking_id',
      foreignField: 'booking_id',
    },
    {
      name: 'reported_user',
      model: 'User',
      localField: 'reported_by',
      foreignField: 'user_id',
    },
    {
      name: 'resolved_user',
      model: 'User',
      localField: 'resolved_by',
      foreignField: 'user_id',
    },
  ],
);
