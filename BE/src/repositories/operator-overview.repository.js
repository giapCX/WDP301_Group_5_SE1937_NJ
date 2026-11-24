const { Booking, Vehicle } = require('../models');

async function getOverview() {
  const rows = await Booking.aggregate([
    { $group: { _id: '$booking_status', total: { $sum: 1 } } },
  ]);
  const totals = Object.fromEntries(rows.map((row) => [row._id, row.total]));
  return {
    totalBookings: rows.reduce((sum, row) => sum + row.total, 0),
    pendingBookings: totals.pending || 0,
    activeTrips: totals.in_progress || 0,
    completedTrips: totals.completed || 0,
  };
}

async function getAvailableVehicles() {
  const items = await Vehicle.find({ status: 'available' })
    .select('vehicle_id brand model plate_number seat_count price_per_day status -_id')
    .sort({ vehicle_id: 1 })
    .lean();
  return { items };
}

module.exports = { getOverview, getAvailableVehicles };
