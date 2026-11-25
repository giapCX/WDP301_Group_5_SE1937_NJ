const { createModel } = require('./model-factory');

module.exports = createModel('VehicleHandover', 'vehicle_handovers', {
  inspection_id: { type: Number, required: true, unique: true },
  booking_id: { type: Number, required: true },
  vehicle_id: { type: Number, required: true },
  driver_id: { type: Number, required: true },
  prepared_by: { type: Number, required: true },
  prepared_at: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  responded_by: { type: Number, default: null },
  responded_at: { type: Date, default: null },
  refusal_reason: { type: String, default: null, maxlength: 500 },
}, [], [{ fields: { booking_id: 1, vehicle_id: 1, inspection_id: -1 }, options: {} }]);
