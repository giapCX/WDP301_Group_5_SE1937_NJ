import { Router } from 'express';
import { ObjectId } from 'mongodb';

const vehicleProjection = {
  brand: 1, model: 1, manufacture_year: 1, seats: 1,
  fuel_type: 1, transmission: 1, vehicle_type: 1,
};

const listingProjection = {
  _id: 1, vehicle_id: 1, title: 1, description: 1, photos: 1,
  pickup_location: 1, daily_price: 1, security_deposit_amount: 1,
  mileage_policy: 1, rental_policy_snapshot: 1, vehicle: 1,
};

function invalidQuery(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function numberQuery(query, key, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (query[key] === undefined) return fallback;
  if (typeof query[key] !== 'string' || query[key].trim() === '') throw invalidQuery(`${key} must be a number.`);
  const value = Number(query[key]);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw invalidQuery(`${key} must be an integer between ${min} and ${max}.`);
  return value;
}

function textQuery(query, key) {
  if (query[key] === undefined) return undefined;
  if (typeof query[key] !== 'string' || query[key].length > 100) throw invalidQuery(`${key} must be a string of at most 100 characters.`);
  return query[key].trim();
}

function publicListingPipeline(match, vehicleMatch = {}) {
  return [
    { $match: match },
    { $lookup: {
      from: 'vehicles', localField: 'vehicle_id', foreignField: '_id', as: 'vehicle',
      pipeline: [
        { $match: { onboarding_status: 'approved', physical_status: { $in: ['at_garage', 'rented'] } } },
        { $project: vehicleProjection },
      ],
    } },
    { $unwind: '$vehicle' },
    { $match: vehicleMatch },
    { $project: listingProjection },
  ];
}

export function createListingsRouter(database) {
  const router = Router();

  router.get('/', async (request, response) => {
    const page = numberQuery(request.query, 'page', 1, { min: 1, max: 100000 });
    const limit = numberQuery(request.query, 'limit', 12, { min: 1, max: 100 });
    const minPrice = numberQuery(request.query, 'minPrice', undefined);
    const maxPrice = numberQuery(request.query, 'maxPrice', undefined);
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) throw invalidQuery('minPrice must not exceed maxPrice.');
    const match = { status: 'published' };
    if (minPrice !== undefined || maxPrice !== undefined) {
      match.daily_price = {};
      if (minPrice !== undefined) match.daily_price.$gte = minPrice;
      if (maxPrice !== undefined) match.daily_price.$lte = maxPrice;
    }
    const q = textQuery(request.query, 'q');
    if (q) match.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const vehicleMatch = {};
    for (const [queryName, field] of [['fuelType', 'fuel_type'], ['transmission', 'transmission'], ['vehicleType', 'vehicle_type']]) {
      const value = textQuery(request.query, queryName);
      if (value) vehicleMatch[`vehicle.${field}`] = value;
    }
    const seats = numberQuery(request.query, 'seats', undefined, { min: 1, max: 50 });
    if (seats !== undefined) vehicleMatch['vehicle.seats'] = seats;
    const sortName = textQuery(request.query, 'sort') || 'newest';
    const sorts = { newest: { _id: -1 }, price_asc: { daily_price: 1, _id: 1 }, price_desc: { daily_price: -1, _id: 1 } };
    if (!Object.hasOwn(sorts, sortName)) throw invalidQuery('sort must be newest, price_asc or price_desc.');
    const [result] = await database.collection('vehicle_listings').aggregate([
      ...publicListingPipeline(match, vehicleMatch),
      { $facet: {
        data: [{ $sort: sorts[sortName] }, { $skip: (page - 1) * limit }, { $limit: limit }],
        count: [{ $count: 'total' }],
      } },
    ]).toArray();
    const total = result.count[0]?.total || 0;
    response.json({ data: result.data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  });

  router.get('/:id', async (request, response) => {
    if (!/^[a-fA-F0-9]{24}$/.test(request.params.id)) throw invalidQuery('Invalid listing ID.');
    const [listing] = await database.collection('vehicle_listings').aggregate(publicListingPipeline({
      _id: new ObjectId(request.params.id), status: 'published',
    })).toArray();
    if (!listing) return response.status(404).json({ error: { message: 'Listing not found.' } });
    response.json({ data: listing });
  });

  return router;
}
