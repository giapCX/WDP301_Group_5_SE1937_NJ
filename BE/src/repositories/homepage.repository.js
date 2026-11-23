const mongoose = require('mongoose');

async function findVehicles({ seats, start, end }) {
  const database = mongoose.connection.db;
  const pipeline = [
    { $match: { $or: [
      { operational_status: 'available', approval_status: 'approved' },
      { operational_status: { $exists: false }, status: 'available' },
    ] } },
    { $project: {
      brand: 1, model: 1, photos: 1, illustration_photos: 1, vehicle_type: 1,
      manufacture_year: 1, fuel_type: 1, transmission: 1,
      seats: { $ifNull: ['$seats', '$seat_count'] },
      dailyPrice: { $ifNull: ['$base_price_per_day', '$price_per_day'] },
      bookingVehicleId: { $ifNull: ['$vehicle_id', '$_id'] },
    } },
    { $match: { seats: { $gte: seats } } },
  ];
  if (start) {
    pipeline.push(
      { $lookup: {
        from: 'bookings',
        localField: 'bookingVehicleId',
        foreignField: 'vehicle_id',
        pipeline: [
          { $match: { $expr: { $and: [
            { $in: [{ $ifNull: ['$status', '$booking_status'] }, ['confirmed', 'ongoing', 'in_progress']] },
            { $lt: [{ $ifNull: ['$start_at', '$pickup_time'] }, end] },
            { $gt: [{ $ifNull: ['$end_at', '$estimated_end_time'] }, start] },
          ] } } },
          { $limit: 1 },
        ],
        as: 'conflicts',
      } },
      { $match: { 'conflicts.0': { $exists: false } } },
    );
  }
  pipeline.push({ $sort: { dailyPrice: 1, _id: 1 } }, { $limit: 12 },
    { $project: { bookingVehicleId: 0, conflicts: 0 } });
  return database.collection('vehicles').aggregate(pipeline).toArray();
}

function findReviews() {
  return mongoose.connection.db.collection('reviews').find(
    { status: 'published', comment: { $type: 'string', $ne: '' } },
    { projection: { comment: 1, rating: 1 } },
  ).sort({ created_at: -1 }).limit(3).toArray();
}

module.exports = { findVehicles, findReviews };
