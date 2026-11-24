const mongoose = require('mongoose');
const { Vehicle } = require('../models');

async function findVehicles({ seats, start, end, type, minPrice, maxPrice, page }) {
  const database = mongoose.connection.db;
  const pipeline = [
    { $match: { $or: [
      { operational_status: 'available', approval_status: 'approved' },
      { operational_status: { $exists: false }, status: 'available' },
    ] } },
    { $project: {
      brand: 1, model: 1, photos: 1, illustration_photos: 1, vehicle_type: 1, vehicle_id: 1, description: 1,
      manufacture_year: 1, fuel_type: 1, transmission: 1,
      seats: { $ifNull: ['$seats', '$seat_count'] },
      dailyPrice: { $ifNull: ['$base_price_per_day', '$price_per_day'] },
      bookingVehicleId: { $ifNull: ['$vehicle_id', '$_id'] },
    } },
    { $match: { seats: { $gte: seats } } },
  ];
  if (type) pipeline.push({ $match: { vehicle_type: type } });
  if (minPrice !== undefined || maxPrice !== undefined) {
    const dailyPrice = {};
    if (minPrice !== undefined) dailyPrice.$gte = minPrice;
    if (maxPrice !== undefined) dailyPrice.$lte = maxPrice;
    pipeline.push({ $match: { dailyPrice } });
  }
  if (start) {
    pipeline.push(
      { $lookup: {
        from: 'bookings',
        localField: 'bookingVehicleId',
        foreignField: 'vehicle_id',
        pipeline: [
          { $match: { $expr: { $and: [
            { $in: [{ $ifNull: ['$status', '$booking_status'] }, ['awaiting_payment', 'confirmed', 'ongoing', 'in_progress']] },
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
  const pageSize = 12;
  pipeline.push({ $sort: { dailyPrice: 1, _id: 1 } });
  if (page) pipeline.push({ $skip: (page - 1) * pageSize });
  pipeline.push({ $limit: page ? pageSize + 1 : pageSize },
    { $project: { bookingVehicleId: 0, conflicts: 0 } });
  const vehicles = await database.collection('vehicles').aggregate(pipeline).toArray();
  return { vehicles: vehicles.slice(0, pageSize), hasNext: vehicles.length > pageSize };
}

function findReviews() {
  return mongoose.connection.db.collection('reviews').find(
    { status: 'published', comment: { $type: 'string', $ne: '' } },
    { projection: { comment: 1, rating: 1 } },
  ).sort({ created_at: -1 }).limit(3).toArray();
}

function findVehicleDetails(vehicleId) {
  return Vehicle.collection.findOne({ vehicle_id: vehicleId }, { projection: {
    _id: 0, vehicle_id: 1, brand: 1, model: 1, vehicle_type: 1, description: 1,
    photos: 1, illustration_photos: 1, manufacture_year: 1, fuel_type: 1,
    seats: { $ifNull: ['$seats', '$seat_count'] },
    dailyPrice: { $ifNull: ['$base_price_per_day', '$price_per_day'] },
  } });
}

function findVehicleTypes() {
  return Vehicle.collection.distinct('vehicle_type', { vehicle_type: { $type: 'string', $ne: '' } });
}

module.exports = { findVehicles, findVehicleDetails, findVehicleTypes, findReviews };
