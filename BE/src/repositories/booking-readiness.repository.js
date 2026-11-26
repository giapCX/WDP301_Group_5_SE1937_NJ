const mongoose = require('mongoose');
const { supportsVehicleSeatCount } = require('../config/vehicle.constants');
const { DriverProfile, User, TripAssignment, Booking, MaintenanceRecord, VehicleInspection, Vehicle } = require('../models');
async function vehicleReady(vehicleId, end, session = null) {
  const vehicle = await Vehicle.findOne({ vehicle_id: vehicleId }).session(session).lean();
  if (!vehicle || !supportsVehicleSeatCount(vehicle.seat_count) || ['pending', 'rejected'].includes(vehicle.approval_status)) return false;
  if (await MaintenanceRecord.exists({ vehicle_id: vehicleId, maintenance_status: { $nin: ['completed', 'closed', 'cancelled'] } }).session(session)) return false;
  const latest = await VehicleInspection.findOne({ vehicle_id: vehicleId, result: { $in: ['pass', 'passed', 'fail', 'failed'] } }).sort({ inspected_at: -1, inspection_id: -1 }).session(session).lean();
  return !['fail', 'failed'].includes(latest?.result);
}
async function availableDrivers(booking, session = null) {
  const drivers = await DriverProfile.find({ approved_at: { $ne: null }, license_expiry: { $gte: booking.estimated_end_time }, availability_status: { $in: ['available', 'busy'] } }).session(session).lean();
  const result = [];
  for (const driver of drivers) {
    if (!await User.exists({ user_id: driver.user_id, status: 'active' }).session(session)) continue;
    const leave = await mongoose.connection.db.collection('driver_unavailability').findOne({ driver_id: driver.driver_id, status: { $nin: ['cancelled', 'rejected'] }, start_at: { $lt: booking.estimated_end_time }, end_at: { $gt: booking.pickup_time } }, { session });
    if (leave) continue;
    const assignments = await TripAssignment.find({ driver_id: driver.driver_id, booking_id: { $ne: booking.booking_id }, assignment_status: { $in: ['assigned', 'accepted', 'in_progress'] } }).session(session).lean();
    if (await Booking.exists({ booking_id: { $in: assignments.map((item) => item.booking_id) }, booking_status: { $in: ['awaiting_payment', 'confirmed', 'in_progress'] }, pickup_time: { $lt: booking.estimated_end_time }, estimated_end_time: { $gt: booking.pickup_time } }).session(session)) continue;
    result.push({ driver_id: driver.driver_id });
  }
  return result;
}
module.exports = { vehicleReady, availableDrivers };
