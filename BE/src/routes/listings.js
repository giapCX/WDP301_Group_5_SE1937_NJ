import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { parseListingsQuery, availabilityPipeline } from './listings-query.js';

const vehicleProjection = {
  brand: 1,
  model: 1,
  manufacture_year: 1,
  seats: 1,
  fuel_type: 1,
  transmission: 1,
  vehicle_type: 1,
};
const listingProjection = {
  _id: 1,
  vehicle_id: 1,
  title: 1,
  description: 1,
  photos: 1,
  pickup_location: 1,
  daily_price: 1,
  security_deposit_amount: 1,
  mileage_policy: 1,
  rental_policy_snapshot: 1,
  vehicle: 1,
};

function publicListingPipeline(match, vehicleMatch = {}) {
  return [
    { $match: match },
    {
      $lookup: {
        from: 'vehicles',
        localField: 'vehicle_id',
        foreignField: '_id',
        as: 'vehicle',
        pipeline: [
          {
            $match: {
              onboarding_status: 'approved',
              physical_status: { $in: ['at_garage', 'rented'] },
            },
          },
          { $project: vehicleProjection },
        ],
      },
    },
    { $unwind: '$vehicle' },
    { $match: vehicleMatch },
    { $project: listingProjection },
  ];
}

export function createListingsRouter(database) {
  const router = Router();
  router.get('/', async (request, response) => {
    const { page, limit, match, vehicleMatch, start, end, sort } =
      parseListingsQuery(request.query);
    const [result] = await database
      .collection('vehicle_listings')
      .aggregate([
        ...publicListingPipeline(match, vehicleMatch),
        ...availabilityPipeline(start, end),
        { $unset: 'conflicts' },
        {
          $facet: {
            data: [
              { $sort: sort },
              { $skip: (page - 1) * limit },
              { $limit: limit },
            ],
            count: [{ $count: 'total' }],
          },
        },
      ])
      .toArray();
    const total = result.count[0]?.total || 0;
    response.json({
      data: result.data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  router.get('/:id', async (request, response) => {
    if (!/^[a-fA-F0-9]{24}$/.test(request.params.id))
      throw Object.assign(new Error('Invalid listing ID.'), { status: 400 });
    const [listing] = await database
      .collection('vehicle_listings')
      .aggregate(
        publicListingPipeline({
          _id: new ObjectId(request.params.id),
          status: 'published',
        }),
      )
      .toArray();
    if (!listing)
      return response
        .status(404)
        .json({ error: { message: 'Listing not found.' } });
    response.json({ data: listing });
  });
  return router;
}
