import { publicListingPipeline } from '../listings/listing.repository.js';
export function createHomepageRepository(database) {
  return {
    async getOverview(now) {
      const [listingInfo, policies] = await Promise.all([database.collection('vehicle_listings').aggregate([...publicListingPipeline({
        status: 'published'
      }), {
        $group: {
          _id: null,
          totalListings: {
            $sum: 1
          },
          cities: {
            $addToSet: '$pickup_location.city'
          }
        }
      }]).toArray(), database.collection('platform_policies').find({
        policy_type: {
          $in: ['commission_default', 'cancellation', 'deposit_refund']
        },
        status: 'active',
        effective_from: {
          $lte: now
        },
        $or: [{
          effective_until: null
        }, {
          effective_until: {
            $gt: now
          }
        }]
      }, {
        projection: {
          _id: 0,
          policy_type: 1,
          config: 1
        }
      }).sort({
        effective_from: -1,
        version: -1
      }).toArray()]);
      return {
        listingInfo,
        policies
      };
    }
  };
}
