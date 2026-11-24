const { Booking, TripAssignment, TripStatusUpdate, TripStop } = require('../models');

function bookingQuery(filter) {
  return Booking.find(filter)
    .select(
      'booking_id renter_id vehicle_id pickup_location dropoff_location pickup_time estimated_end_time booking_status -_id',
    )
    .populate({
      path: 'vehicle',
      select: 'vehicle_id brand model plate_number seat_count -_id',
    })
    .populate({ path: 'renter', select: 'full_name phone -_id' });
}

async function enrich(bookings) {
  const ids = bookings.map((item) => item.booking_id);
  const [assignments, updates] = await Promise.all([
    TripAssignment.find({ booking_id: { $in: ids } })
      .select('assignment_id booking_id driver_id assignment_status assigned_at -_id')
      .sort({ assigned_at: -1, assignment_id: -1 })
      .populate({
        path: 'driver',
        select: 'driver_id user_id -_id',
        populate: { path: 'user', select: 'full_name phone -_id' },
      })
      .lean(),
    TripStatusUpdate.aggregate([
      { $match: { booking_id: { $in: ids } } },
      { $sort: { updated_at: -1, update_id: -1 } },
      { $group: { _id: '$booking_id', update: { $first: '$$ROOT' } } },
      { $project: { _id: 0, 'update._id': 0 } },
    ]),
  ]);
  return bookings.map((booking) => {
    const latest = assignments.find((item) => item.booking_id === booking.booking_id);
    const assignment =
      latest && !['rejected', 'cancelled'].includes(latest.assignment_status)
        ? latest
        : null;
    return {
      booking,
      assignment,
      latest_update:
        updates.find((item) => item.update.booking_id === booking.booking_id)?.update ||
        null,
    };
  });
}

async function list({ status, page, limit }) {
  const filter = {
    booking_status:
      status === 'all' ? { $in: ['confirmed', 'in_progress', 'completed'] } : status,
  };
  const [bookings, total, counts] = await Promise.all([
    bookingQuery(filter)
      .sort({ pickup_time: -1, booking_id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
    Booking.aggregate([
      { $match: { booking_status: { $in: ['confirmed', 'in_progress', 'completed'] } } },
      { $group: { _id: '$booking_status', total: { $sum: 1 } } },
    ]),
  ]);
  return {
    items: await enrich(bookings),
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
    stats: {
      confirmed: 0,
      in_progress: 0,
      completed: 0,
      ...Object.fromEntries(counts.map((item) => [item._id, item.total])),
    },
  };
}

async function detail(id) {
  const [booking] = await bookingQuery({ booking_id: id }).lean();
  if (!booking) return null;
  const [row] = await enrich([booking]);
  const [stops, updates] = await Promise.all([
    TripStop.find({ booking_id: id })
      .select('stop_id stop_order location note -_id')
      .sort({ stop_order: 1 })
      .lean(),
    TripStatusUpdate.find({ booking_id: id })
      .select('update_id updated_by trip_status updated_at -_id')
      .sort({ updated_at: -1, update_id: -1 })
      .limit(20)
      .lean(),
  ]);
  return {
    booking,
    assigned_at: row.assignment?.assigned_at || null,
    driver: row.assignment?.driver?.user || null,
    stops,
    updates,
  };
}

module.exports = { list, detail };
