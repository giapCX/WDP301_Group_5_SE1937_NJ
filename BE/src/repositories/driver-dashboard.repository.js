const {
  TripAssignment,
  DriverProfile,
  TripStop,
  TripStatusUpdate,
} = require('../models');

async function profile(userId) {
  return DriverProfile.findOne({ user_id: userId })
    .select('driver_id availability_status license_expiry approved_at -_id')
    .lean()
    .exec();
}

async function assignedTrips(driverId) {
  const assignments = await TripAssignment.find({ driver_id: driverId })
    .sort({ assigned_at: -1, assignment_id: -1 })
    .select('assignment_id booking_id assigned_at assignment_status -_id')
    .populate({
      path: 'booking',
      select:
        'booking_id renter_id vehicle_id pickup_location dropoff_location pickup_time estimated_end_time booking_status -_id',
      populate: [
        {
          path: 'vehicle',
          select: 'vehicle_id plate_number brand model seat_count -_id',
        },
        { path: 'renter', select: 'full_name phone -_id' },
      ],
    })
    .lean()
    .exec();
  const seen = new Set();
  return assignments.filter((item) => {
    if (!item.booking || seen.has(item.booking_id)) return false;
    seen.add(item.booking_id);
    return true;
  });
}

async function tripDetail(driverId, bookingId) {
  const assigned = await TripAssignment.exists({
    driver_id: driverId,
    booking_id: bookingId,
    assignment_status: { $nin: ['rejected', 'cancelled'] },
  });
  if (!assigned) return null;
  const trips = await assignedTrips(driverId);
  const trip = trips.find(
    (item) =>
      item.booking_id === bookingId &&
      !['rejected', 'cancelled'].includes(item.assignment_status),
  );
  if (!trip) return null;
  const [stops, updates] = await Promise.all([
    TripStop.find({ booking_id: bookingId })
      .select('stop_id stop_order location note -_id')
      .sort({ stop_order: 1 })
      .lean(),
    TripStatusUpdate.find({ booking_id: bookingId })
      .select('update_id trip_status updated_at -_id')
      .sort({ updated_at: -1, update_id: -1 })
      .limit(20)
      .lean(),
  ]);
  return { ...trip, stops, updates };
}

module.exports = { profile, assignedTrips, tripDetail };
