const tripFields = {
  booking_code: 1, status: 1, service_type: 1, start_at: 1, end_at: 1,
  pickup_location: 1, destination: 1, dropoff_location: 1,
  total_price: 1, rental_fee_amount: 1, discount_amount: 1,
  vehicle: { $first: '$vehicle' },
};

const withVehicle = [
  { $lookup: {
    from: 'vehicles',
    localField: 'vehicle_id',
    foreignField: '_id',
    pipeline: [{ $project: { _id: 0, brand: 1, model: 1, seats: 1 } }],
    as: 'vehicle',
  } },
  { $project: tripFields },
];

export function createRenterDashboardRepository(database) {
  return {
    async findOverview(renterId, now) {
      const upcoming = {
        start_at: { $gte: now },
        status: { $in: ['confirmed', 'pending', 'awaiting_payment', 'approved'] },
      };
      const [overview] = await database.db.collection('bookings').aggregate([
        { $match: { renter_id: renterId } },
        { $facet: {
          totals: [{ $group: {
            _id: null,
            bookings: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            discounted: { $sum: { $cond: [{ $gt: ['$discount_amount', 0] }, 1, 0] } },
          } }],
          upcomingCount: [{ $match: upcoming }, { $count: 'total' }],
          upcomingTrip: [{ $match: upcoming }, { $sort: { start_at: 1 } }, { $limit: 1 }, ...withVehicle],
          recentTrips: [{ $sort: { start_at: -1 } }, { $limit: 5 }, ...withVehicle],
          recentOffers: [
            { $lookup: {
              from: 'booking_promotions', localField: '_id', foreignField: 'booking_id', as: 'promotion',
            } },
            { $unwind: '$promotion' },
            { $sort: { 'promotion.applied_at': -1, 'promotion._id': -1 } },
            { $limit: 3 },
            { $project: { _id: '$promotion._id', booking_code: 1, code: '$promotion.promotion_code',
              amount: '$promotion.discount_amount', applied_at: '$promotion.applied_at' } },
          ],
        } },
      ]).toArray();
      const upcomingTrip = overview.upcomingTrip[0];
      const stops = upcomingTrip
        ? await database.db.collection('trip_stops')
          .find({ booking_id: upcomingTrip._id }, {
            projection: { _id: 1, location: 1, stop_type: 1, planned_arrival_at: 1 },
          }).sort({ stop_order: 1 }).limit(20).toArray()
        : [];
      return {
        metrics: {
          bookings: overview.totals[0]?.bookings ?? 0,
          completed: overview.totals[0]?.completed ?? 0,
          discounted: overview.totals[0]?.discounted ?? 0,
          upcoming: overview.upcomingCount[0]?.total ?? 0,
        },
        upcomingTrip: upcomingTrip ? { ...upcomingTrip, stops } : null,
        recentTrips: overview.recentTrips,
        recentOffers: overview.recentOffers,
      };
    },
  };
}
