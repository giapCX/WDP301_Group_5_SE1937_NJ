const validObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const preparableStatuses = ['draft', 'pending_signatures', 'pending_signature', 'awaiting_signature'];
const contractNeedsPreparation = (agreement) => !agreement
  || (!agreement.contract_document && preparableStatuses.includes(agreement.status));

export function createManagerApprovalService(repository, service, contracts) {
  return {
    async decideBooking(input, actor) {
      const existing = input.body?.action === 'approve' && validObjectId(input.id)
        ? await repository.collection('bookings').findOne({ _id: input.id })
        : null;
      const agreement = existing?.status === 'awaiting_payment'
        ? await repository.collection('rental_agreements').findOne({ booking_id: existing._id })
        : null;
      const result = existing?.status === 'awaiting_payment' && existing.review_info?.decision === 'approved'
        && contractNeedsPreparation(agreement)
        ? { data: {
          id: String(existing._id),
          status: existing.status,
          decision: 'approved',
          ...(existing.payment_deadline_at ? { paymentDeadline: existing.payment_deadline_at } : {}),
        } }
        : await service.decideBooking(input);
      if (result.data.status === 'awaiting_payment') {
        const contract = await contracts.prepare('rental', input.id, {}, actor);
        result.data.contractNumber = contract.number;
      }
      return result;
    },

    async reviewVehicle(input, actor) {
      let result;
      if (input.body?.action === 'approve' && validObjectId(input.id)
        && validObjectId(input.body.inspectionId) && Number.isSafeInteger(input.body.inspectionVersion)) {
        const vehicle = await repository.vehicles.findOne({ _id: input.id });
        const inspection = vehicle?.onboarding_status === 'approved'
          ? await repository.inspections.findOne({
            _id: input.body.inspectionId,
            vehicle_id: vehicle._id,
            approval_status: 'approved',
            recommendation: 'pass',
            version: input.body.inspectionVersion,
          })
          : null;
        const agreement = inspection
          ? await repository.collection('management_agreements').findOne({
            vehicle_id: vehicle._id,
            status: { $nin: ['terminated', 'expired', 'cancelled'] },
          })
          : null;
        if (inspection && contractNeedsPreparation(agreement)) result = { data: { id: String(vehicle._id), status: 'approved' } };
      }
      if (!result) {
        result = await service.reviewVehicle(input);
      }
      if (result.data.status === 'approved') {
        const existing = await repository.collection('management_agreements').findOne({
          vehicle_id: input.id,
          status: { $nin: ['terminated', 'expired', 'cancelled'] },
        });
        if (!existing || preparableStatuses.includes(existing.status)) {
          const contract = await contracts.prepare('management', input.id, {}, actor);
          result.data.contractNumber = contract.number;
          result.data.contractStatus = contract.status;
        }
      }
      return result;
    },
  };
}
