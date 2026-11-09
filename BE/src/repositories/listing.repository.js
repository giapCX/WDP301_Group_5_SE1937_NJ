import { Types } from 'mongoose';
import { getModels } from '../models/index.js';

const { ObjectId } = Types;
const vehicleProjection = {
  brand: 1,
  model: 1,
  manufacture_year: 1,
  seats: 1,
  fuel_type: 1,
  transmission: 1,
  vehicle_type: 1
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
  vehicle: 1
};
export function publicListingPipeline(match, vehicleMatch = {}, rentalPeriod) {
  return [{
    $match: match
  }, {
    $lookup: {
      from: 'vehicles',
      localField: 'vehicle_id',
      foreignField: '_id',
      as: 'vehicle',
      pipeline: [{
        $match: {
          onboarding_status: 'approved',
          physical_status: {
            $in: ['at_garage', 'rented']
          }
        }
      }, {
        $project: vehicleProjection
      }]
    }
  }, {
    $unwind: '$vehicle'
  }, {
    $match: vehicleMatch
  }, ...(rentalPeriod ? [{
    $lookup: {
      from: 'bookings',
      let: {
        vehicleId: '$vehicle_id'
      },
      pipeline: [{
        $match: {
          $expr: {
            $and: [{
              $eq: ['$vehicle_id', '$$vehicleId']
            }, {
              $in: ['$status', ['pending', 'awaiting_payment', 'confirmed', 'ongoing']]
            }, {
              $lt: ['$start_at', rentalPeriod.end]
            }, {
              $gt: ['$end_at', rentalPeriod.start]
            }]
          }
        }
      }, {
        $project: {
          _id: 1
        }
      }, {
        $limit: 1
      }],
      as: 'conflictingBookings'
    }
  }, {
    $match: {
      'conflictingBookings.0': {
        $exists: false
      }
    }
  }] : []), {
    $project: listingProjection
  }];
}
export function createListingRepository(database) {
  const { VehicleListing } = getModels(database);
  return {
    async findPublic({
      match,
      vehicleMatch,
      rentalPeriod,
      sort,
      page,
      limit
    }) {
      const [result] = await VehicleListing.aggregate([...publicListingPipeline(match, vehicleMatch, rentalPeriod), {
        $facet: {
          data: [{
            $sort: sort
          }, {
            $skip: (page - 1) * limit
          }, {
            $limit: limit
          }],
          count: [{
            $count: 'total'
          }]
        }
      }]).exec();
      return result;
    },
    async findPublicById(id) {
      const [listing] = await VehicleListing.aggregate(publicListingPipeline({
        _id: new ObjectId(id),
        status: 'published'
      })).exec();
      return listing;
    }
  };
}
