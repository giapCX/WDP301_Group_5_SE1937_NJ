import { publicListingPipeline } from './listing.repository.js';
import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';
export function createHomepageRepository(database) {
  const models = getModels(database);
  const listings = createModelRepository(models.VehicleListing);
  const policiesRepository = createModelRepository(models.PlatformPolicy);
  return {
    async getOverview(now) {
      const [listingInfo, policies] = await Promise.all([listings.aggregate([...publicListingPipeline({
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
      }]).exec(), policiesRepository.find({
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
      }).exec()]);
      return {
        listingInfo,
        policies
      };
    }
  };
}
