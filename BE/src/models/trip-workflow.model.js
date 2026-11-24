const mongoose = require('mongoose');
const { createModel } = require('./model-factory');

const historySchema = new mongoose.Schema({
  action: { type: String, required: true },
  actor_id: { type: Number, required: true },
  note: { type: String, default: null },
  created_at: { type: Date, required: true },
}, { _id: false });

module.exports = createModel('TripWorkflow', 'trip_workflows', {
  booking_id: { type: Number, required: true, unique: true },
  service_type: { type: String, enum: ['one_way', 'round_trip', 'tour'], required: true },
  return_pickup_time: { type: Date, default: null },
  return_pickup_location: { type: String, default: null, maxlength: 255 },
  return_dropoff_location: { type: String, default: null, maxlength: 255 },
  driver_id: { type: Number, required: true },
  vehicle_id: { type: Number, required: true },
  driver_response: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  stage: { type: String, required: true, default: 'awaiting_driver' },
  handover_inspection_id: { type: Number },
  resume_stage: { type: String, default: null },
  leg: { type: String, enum: ['outbound', 'return'], default: 'outbound' },
  vehicle_received: { type: Boolean, default: false },
  vehicle_returned: { type: Boolean, default: false },
  vehicle_received_at: { type: Date, default: null },
  vehicle_returned_at: { type: Date, default: null },
  started_at: { type: Date, default: null },
  picked_up_at: { type: Date, default: null },
  outbound_completed_at: { type: Date, default: null },
  return_started_at: { type: Date, default: null },
  ended_at: { type: Date, default: null },
  start_odometer: { type: Number, default: null },
  end_odometer: { type: Number, default: null },
  delay_minutes: { type: Number, default: 0 },
  delay_reason: { type: String, default: null },
  report_summary: { type: String, default: null },
  report_created_at: { type: Date, default: null },
  completed_stops: { type: [Number], default: [] },
  incident_ids: { type: [Number], default: [] },
  history: { type: [historySchema], default: [] },
  created_at: { type: Date, required: true },
  updated_at: { type: Date, required: true },
}, [], [{ fields: { stage: 1, updated_at: -1 }, options: {} }]);
