import { httpError } from '../utils/http-error.js';
import { BOOKING_REVIEWER_ROLE } from '../utils/booking-hold.js';
const validObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const preparableStatuses = ['draft', 'pending_signatures', 'pending_signature', 'awaiting_signature'];
const contractNeedsPreparation = (agreement) => !agreement
  || (!agreement.contract_document && preparableStatuses.includes(agreement.status));

export function createManagerApprovalService(repository, service, contracts) {
  return {
    async decideBooking(input, actor) {
      if (input.operatorQueue) return service.decideBooking(input);
      const existing = input.body?.action === 'approve' && validObjectId(input.id)
        ? await repository.collection('bookings').findOne({ _id: input.id })
        : null;
      const agreement = existing?.status === 'awaiting_payment'
        ? await repository.collection('rental_agreements').findOne({ booking_id: existing._id })
        : null;
      const correctQueue = Boolean(input.operatorQueue) === (existing?.review_info?.reviewer_role === BOOKING_REVIEWER_ROLE);
      const result = correctQueue && existing?.status === 'awaiting_payment' && existing.review_info?.decision === 'approved'
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
      const { action, note, inspectionId, inspectionVersion } = input.body || {};
      if (action === 'approve' && validObjectId(input.id) && validObjectId(inspectionId)
        && Number.isSafeInteger(inspectionVersion) && typeof note === 'string' && note.trim().length >= 5) {
        const vehicle = await repository.vehicles.findOne({ _id: input.id });
        if (vehicle?.onboarding_status === 'approved' && String(vehicle.reviewed_by_manager_id) === String(input.actorId)
          && vehicle.review_note === note.trim()) {
          const latest = await repository.inspections.findOne(
            { vehicle_id: vehicle._id, inspection_type: 'onboarding' },
            { sort: { created_at: -1, _id: -1 } },
          );
          const sameVersion = (latest?.version ?? 0) === inspectionVersion;
          const approvedFromVersion = latest?.version === inspectionVersion + 1
            && String(latest.reviewed_by_manager_id) === String(input.actorId)
            && latest.decision_reason === note.trim();
          if (String(latest?._id) === inspectionId && latest.approval_status === 'approved'
            && latest.recommendation === 'pass' && (sameVersion || approvedFromVersion)) {
            result = { data: { id: String(vehicle._id), status: 'approved', inspectionId: latest._id, inspectionStatus: 'approved' } };
          }
        }
      }
      if (!result) {
        result = await service.reviewVehicle(input);
      }
      if (result.data.status === 'approved') {
        const existing = await repository.collection('management_agreements').findOne({
          vehicle_id: input.id,
          status: { $nin: ['terminated', 'expired', 'cancelled'] },
        });
        if (contractNeedsPreparation(existing)) {
          try {
            const contract = await contracts.prepare('management', input.id, {}, actor);
            result.data.contractNumber = contract.number;
            result.data.contractStatus = contract.status;
          } catch (error) {
            if (error.status >= 400 && error.status < 500) {
              throw httpError(error.status, `Xe đã được duyệt. Chưa lập được hợp đồng. ${error.message}`);
            }
            console.error('Could not prepare contract after vehicle approval', error);
            throw httpError(503, 'Xe đã được duyệt. Chưa thể lập hợp đồng. Hãy thử lưu lại hoặc mở mục Quản lý hợp đồng.');
          }
        } else if (existing) {
          result.data.contractNumber = existing.agreement_number;
          result.data.contractStatus = existing.status;
        }
      }
      return result;
    },
  };
}
