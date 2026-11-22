import { Types } from 'mongoose';

export const visibleVietTourVehicles = {
  approval_status: 'approved',
  operational_status: 'available',
};

const publicFields = {
  status: { $literal: 'published' },
  source: { $literal: 'viet_tour' },
  title: { $concat: ['$brand', ' ', '$model'] },
  daily_price: '$base_price_per_day',
  photos: { $ifNull: ['$photos', []] },
  vehicle: {
    brand: '$brand',
    model: '$model',
    seats: '$seats',
    vehicle_type: '$vehicle_type',
  },
};

export function createVietTourListingRepository(database) {
  const vehicles = database.db.collection('vehicles');

  return {
    async findPublic({ match, vehicleMatch, rentalPeriod, sort, page, limit }) {
      const pipeline = [
        { $match: visibleVietTourVehicles },
        { $project: publicFields },
      ];
      const { availability_blocks, ...publicMatch } = match;
      pipeline.push({ $match: { ...publicMatch, ...vehicleMatch } });
      if (rentalPeriod) {
        const { start, end } = rentalPeriod;
        pipeline.push({
          $lookup: {
            from: 'bookings',
            localField: '_id',
            foreignField: 'vehicle_id',
            pipeline: [
              { $match: {
                status: { $nin: ['cancelled', 'canceled', 'rejected', 'completed', 'expired'] },
                start_at: { $lt: end },
                end_at: { $gt: start },
              } },
              { $limit: 1 },
            ],
            as: 'conflicting_bookings',
          },
        }, { $match: { 'conflicting_bookings.0': { $exists: false } } }, { $unset: 'conflicting_bookings' });
      }
      pipeline.push({
        $facet: {
          data: [{ $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit }],
          count: [{ $count: 'total' }],
        },
      });
      const [result] = await vehicles.aggregate(pipeline).toArray();
      return result;
    },
    async findPublicById(id) {
      const [vehicle] = await vehicles.aggregate([
        { $match: { ...visibleVietTourVehicles, _id: new Types.ObjectId(id) } },
        { $project: publicFields },
      ]).toArray();
      return vehicle;
    },
    async findPublishedPhotoKey() {
      return null;
    },
  };
}
