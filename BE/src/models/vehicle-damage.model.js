const { createModel } = require('./model-factory');
const photoSchema = require('./garage-photo.schema');

module.exports = createModel('VehicleDamage', 'vehicle_damages', {
  inspection_id: { type: Number, required: true, unique: true },
  booking_id: { type: Number, required: true },
  vehicle_id: { type: Number, required: true },
  reported_by: { type: Number, required: true },
  reported_at: { type: Date, required: true },
  damaged_items: { type: [String], required: true },
  description: { type: String, required: true, maxlength: 1000 },
  evidence_source: { type: String, enum: ['inspection', 'upload'], required: true },
  photo_count: { type: Number, required: true, min: 1, max: 3 },
  photos: { type: [photoSchema], default: undefined, select: false },
  maintenance_id: { type: Number, default: null },
  incident_id: { type: Number, default: null },
});
