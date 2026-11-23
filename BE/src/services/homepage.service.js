export function createHomepageService(repository) {
  return {
    async getOverview() {
      const {
        listingInfo,
        policies
      } = await repository.getOverview(new Date());
      const active = {};
      for (const policy of policies) active[policy.policy_type] ??= policy.config;
      return {
        data: {
          totalListings: listingInfo[0]?.totalListings || 0,
          cities: (listingInfo[0]?.cities || []).filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi')),
          policies: {
            commissionPercent: active.commission_default?.default_commission_pct ?? null,
            freeCancellationHours: active.cancellation?.free_cancel_before_hours ?? null,
            depositRefundBusinessDays: active.deposit_refund?.refund_within_business_days ?? null
          }
        }
      };
    }
  };
}
