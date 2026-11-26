const mongoose = require('mongoose');
const { Vehicle } = require('../models');
const { SUPPORTED_VEHICLE_SEAT_COUNTS } = require('../config/vehicle.constants');
const catalogAvailability = { $or: [
  { operational_status: 'available', approval_status: 'approved' },
  { operational_status: { $exists: false }, status: 'available' },
] };
const seatCount = { $ifNull: ['$seats', '$seat_count'] };
const rentalRate = { $ifNull: ['$base_price_per_day', '$price_per_day'] };

async function findVehicles({ seats, start, end, type, minPrice, maxPrice, priceBelow, page }) {
  const database = mongoose.connection.db;
  const pipeline = [
    { $match: catalogAvailability },
    { $project: {
      brand: 1, model: 1, photos: 1, illustration_photos: 1, vehicle_type: 1, vehicle_id: 1, description: 1,
      manufacture_year: 1, fuel_type: 1, transmission: 1,
      seats: seatCount,
      dailyPrice: rentalRate,
      bookingVehicleId: { $ifNull: ['$vehicle_id', '$_id'] },
    } },
    { $match: { seats: { $in: SUPPORTED_VEHICLE_SEAT_COUNTS.filter((count) => count >= seats) } } },
  ];
  if (type) pipeline.push({ $match: { vehicle_type: type } });
  if (minPrice !== undefined || maxPrice !== undefined || priceBelow !== undefined) {
    const dailyPrice = {};
    if (minPrice !== undefined) dailyPrice.$gte = minPrice;
    if (maxPrice !== undefined) dailyPrice.$lte = maxPrice;
    if (priceBelow !== undefined) dailyPrice.$lt = priceBelow;
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
  return Vehicle.collection.findOne({ vehicle_id: vehicleId, seat_count: { $in: SUPPORTED_VEHICLE_SEAT_COUNTS } }, { projection: {
    _id: 0, vehicle_id: 1, brand: 1, model: 1, vehicle_type: 1, description: 1,
    photos: 1, illustration_photos: 1, manufacture_year: 1, fuel_type: 1,
    seats: seatCount,
    dailyPrice: rentalRate,
  } });
}

function findVehicleTypes() {
  return Vehicle.collection.distinct('vehicle_type', {
    vehicle_type: { $type: 'string', $ne: '' }, seat_count: { $in: SUPPORTED_VEHICLE_SEAT_COUNTS },
  });
}

async function findVehicleFilters() {
  const [options] = await Vehicle.aggregate([
    { $match: { ...catalogAvailability, seat_count: { $in: SUPPORTED_VEHICLE_SEAT_COUNTS } } },
    { $project: { seats: seatCount, dailyPrice: rentalRate, vehicle_type: 1 } },
    { $group: { _id: null, seats: { $addToSet: '$seats' }, prices: { $addToSet: '$dailyPrice' }, types: { $addToSet: '$vehicle_type' } } },
  ]);
  const ascending = (a, b) => a - b;
  const priceBands = (options?.prices ?? [])
    .filter((price) => typeof price === 'number' && price >= 0)
    .map(Math.floor)
    .filter(Number.isSafeInteger);
  return {
    seats: SUPPORTED_VEHICLE_SEAT_COUNTS.filter((value) => (options?.seats ?? []).includes(value)).sort(ascending),
    prices: [...new Set(priceBands)].sort(ascending),
    types: (options?.types ?? []).filter((value) => typeof value === 'string' && value.trim()).sort(),
  };
}

module.exports = { findVehicles, findVehicleDetails, findVehicleTypes, findVehicleFilters, findReviews };
