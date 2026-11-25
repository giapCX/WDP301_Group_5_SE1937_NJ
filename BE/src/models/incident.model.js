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
    kind: { type: String, enum: ['other', 'vehicle_failure', 'customer_route_change', 'complaint', 'accident'], default: 'other' },
    evidence: { type: [String], default: [] },
    reported_at: Date, resolved_at: Date,
    resolution_approval: require('./operation.schema').approvalSchema,
    history: { type: [require('./operation.schema').historySchema], default: [] },
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
