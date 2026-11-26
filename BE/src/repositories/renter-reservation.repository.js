const mongoose = require('mongoose');
const { Booking, TripAssignment, Vehicle } = require('../models');
const { findAvailableVehicles } = require('./booking.repository');
const { SUPPORTED_VEHICLE_SEAT_COUNTS } = require('../config/vehicle.constants');

async function nextIds(model, key, count, session) {
  const last = await model.findOne().sort({ [key]: -1 }).select(key).session(session).lean();
  const result = await mongoose.connection.db.collection('sequences').findOneAndUpdate(
    { _id: model.collection.name },
    [{ $set: { value: { $add: [{ $max: [{ $ifNull: ['$value', 0] }, last?.[key] || 0] }, count] } } }],
    { upsert: true, returnDocument: 'after', session },
  );
  return result.value - count + 1;
}

async function hasAssignedTrip(vehicleId, pickupTime, estimatedEndTime, session) {
  const overlaps = await Booking.find({
    vehicle_id: vehicleId,
    booking_status: { $nin: ['cancelled', 'rejected', 'completed'] },
    pickup_time: { $lt: estimatedEndTime },
    estimated_end_time: { $gt: pickupTime },
  }).select('booking_id -_id').session(session).lean();
  return TripAssignment.exists({
    booking_id: { $in: overlaps.map((booking) => booking.booking_id) },
    assignment_status: { $in: ['assigned', 'accepted', 'in_progress'] },
  }).session(session);
}

async function findAssignableVehicle({ bookingId, pickupTime, estimatedEndTime, minSeats, session }) {
  const candidates = await findAvailableVehicles({ bookingId, pickupTime, estimatedEndTime, minSeats, session });
  for (const vehicle of candidates) {
    if (!(await hasAssignedTrip(vehicle.vehicle_id, pickupTime, estimatedEndTime, session)) && await require('./booking-readiness.repository').vehicleReady(vehicle.vehicle_id, estimatedEndTime, session)) return vehicle;
  }
  return null;
}

async function findSeatOptions() {
  return SUPPORTED_VEHICLE_SEAT_COUNTS;
}

async function listBookings(renterId, before) {
  const filter = { renter_id: renterId };
  if (before) filter.booking_id = { $lt: before };
  const pageSize = 20;
  const rows = await Booking.find(filter)
    .select('-_id -renter_request_id -checkout_attempt -__v')
    .sort({ booking_id: -1 }).limit(pageSize + 1)
    .populate('vehicle', 'brand model photos illustration_photos seat_count -_id').lean();
  const items = rows.slice(0, pageSize);
  return { items, nextBefore: rows.length > pageSize ? items.at(-1).booking_id : null };
}

module.exports = { nextIds, hasAssignedTrip, findAssignableVehicle, findSeatOptions, listBookings };

