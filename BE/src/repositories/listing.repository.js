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
              $or: [
                { $in: ['$status', ['confirmed', 'ongoing']] },
                { $and: [
                  { $in: ['$status', ['pending', 'awaiting_payment']] },
                  { $or: [{ $eq: [{ $type: '$hold_expires_at' }, 'missing'] }, { $gt: ['$hold_expires_at', new Date()] }] }
                ] }
              ]
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
  const { VehicleListing, Vehicle } = getModels(database);
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
    async findPublishedPhotoKey(id, index) {
      const url = `/api/listings/${id}/photos/${index}`;
      const listing = await VehicleListing.findOne({ _id: new ObjectId(id), status: 'published', photos: url }).select('vehicle_id').lean();
      if (!listing) return null;
      const vehicle = await Vehicle.findOne({
        _id: listing.vehicle_id, onboarding_status: 'approved', physical_status: { $in: ['at_garage', 'rented'] }, publish_vehicle_photos: true,
      }).select('photos').lean();
      return vehicle?.photos?.[index] || null;
    },
    async findPublicById(id) {
      const [listing] = await VehicleListing.aggregate(publicListingPipeline({
        _id: new ObjectId(id),
        status: 'published'
      })).exec();
      if (listing) listing.reviews = await database.db.collection('reviews').find({ vehicle_id: listing.vehicle_id, is_visible: true }, { projection: { rating: 1, comment: 1, created_at: 1 } }).sort({ created_at: -1 }).limit(20).toArray();
      return listing;
    }
  };
}
