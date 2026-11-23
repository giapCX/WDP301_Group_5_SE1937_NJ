const mongoose = require('mongoose');

const bookingFields = {
  _id: 0, booking_id: 1, pickup_location: 1, dropoff_location: 1,
  pickup_time: 1, estimated_end_time: 1, estimated_price: 1, booking_status: 1, vehicle_id: 1,
};
const historyLimit = 5;

async function findRenterDashboard(renterId, now = new Date()) {
  const { db } = mongoose.connection;
  const upcoming = { booking_status: 'confirmed', pickup_time: { $gte: now } };
  const promotions = { status: 'active', valid_until: { $gte: now } };
  const [[activity], [offers]] = await Promise.all([
    db.collection('bookings').aggregate([
      { $match: { renter_id: renterId } },
      { $facet: {
        totals: [{ $group: { _id: '$booking_status', count: { $sum: 1 } } }],
        upcoming: [{ $match: upcoming }, { $count: 'count' }],
        active: [
          { $match: { $or: [{ booking_status: 'in_progress' }, upcoming] } },
          { $sort: { booking_status: -1, pickup_time: 1, booking_id: 1 } },
          { $limit: 1 },
          { $project: bookingFields },
        ],
        history: [
          { $match: { booking_status: { $in: ['completed', 'cancelled', 'rejected'] } } },
          { $sort: { pickup_time: -1, booking_id: -1 } },
          { $limit: historyLimit },
          { $project: bookingFields },
        ],
      } },
    ]).toArray(),
    db.collection('promotions').aggregate([
      { $match: promotions },
      { $facet: {
        total: [{ $count: 'count' }],
        items: [{ $sort: { valid_until: 1, promotion_id: 1 } }, { $limit: historyLimit },
          { $project: { _id: 0, promotion_id: 1, code: 1, discount_percent: 1, valid_until: 1 } }],
      } },
    ]).toArray(),
  ]);

  const currentTrip = activity.active[0] || null;
  if (currentTrip) {
    const { booking_id, vehicle_id } = currentTrip;
    const [stops, update, vehicle] = await Promise.all([
      db.collection('trip_stops').find({ booking_id }, { projection: { _id: 0, stop_order: 1, location: 1 } })
        .sort({ stop_order: 1 }).limit(50).toArray(),
      db.collection('trip_status_updates').findOne({ booking_id }, {
        sort: { updated_at: -1, update_id: -1 }, projection: { _id: 0, trip_status: 1, updated_at: 1 },
      }),
      vehicle_id ? db.collection('vehicles').findOne({ vehicle_id }, {
        projection: { _id: 0, brand: 1, model: 1, photos: 1 },
      }) : null,
    ]);
    Object.assign(currentTrip, { stops, update, vehicle });
  }

  return {
    stats: {
      total: activity.totals.reduce((total, item) => total + item.count, 0),
      completed: activity.totals.find(({ _id }) => _id === 'completed')?.count || 0,
      upcoming: activity.upcoming[0]?.count || 0,
      offers: offers.total[0]?.count || 0,
    },
    currentTrip,
    history: activity.history,
    offers: offers.items,
  };
}

module.exports = { findRenterDashboard };
