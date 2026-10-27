import { Router } from 'express';
import { publicListingPipeline } from './listings.js';

export function createHomepageRouter(database) {
  const router = Router();
  router.get('/', async (_request, response) => {
    const now = new Date();
    const [listingInfo, policies] = await Promise.all([
      database
        .collection('vehicle_listings')
        .aggregate([
          ...publicListingPipeline({ status: 'published' }),
          {
            $group: {
              _id: null,
              totalListings: { $sum: 1 },
              cities: { $addToSet: '$pickup_location.city' },
            },
          },
        ])
        .toArray(),
      database
        .collection('platform_policies')
        .find(
          {
            policy_type: { $in: ['commission_default', 'cancellation', 'deposit_refund'] },
            status: 'active',
            effective_from: { $lte: now },
            $or: [{ effective_until: null }, { effective_until: { $gt: now } }],
          },
          { projection: { _id: 0, policy_type: 1, config: 1 } },
        )
        .sort({ effective_from: -1, version: -1 })
        .toArray(),
    ]);
    const active = {};
    for (const policy of policies) active[policy.policy_type] ??= policy.config;
    response.json({
      data: {
        totalListings: listingInfo[0]?.totalListings || 0,
        cities: (listingInfo[0]?.cities || [])
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, 'vi')),
        policies: {
          commissionPercent: active.commission_default?.default_commission_pct ?? null,
          freeCancellationHours: active.cancellation?.free_cancel_before_hours ?? null,
          depositRefundBusinessDays: active.deposit_refund?.refund_within_business_days ?? null,
        },
      },
    });
  });
  return router;
}
