import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';
import { garageTransaction } from '../utils/garage-transaction.js';

const OPEN_CASES = ['reported', 'open', 'investigating', 'pending_review', 'pending_manager', 'awaiting_response'];
const decisions = { approve: 'approved', revision: 'revision_required', reject: 'rejected' };
const objectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value) ? new Types.ObjectId(value) : null;
const same = (a, b) => a && b && String(a) === String(b);
const versionFilter = (record) => record.version === undefined ? { version: { $exists: false } } : { version: record.version };

export function createManagerGarageService(repository) {
  const collection = (name) => repository.collection(name);
  const audit = (actorId, action, entityType, entityId, changes, session) => collection('audit_logs').create({
    actor_user_id: actorId, action, entity_type: entityType, entity_id: entityId,
    sanitized_changes: changes, created_at: new Date(),
  }, { session });

  return {
    async reviewVehicle({ id: value, body = {}, actorId }) {
      const id = objectId(value);
      const { action, note = '', inspectionId, inspectionVersion } = body;
      if (!id || !Object.hasOwn(decisions, action) || typeof note !== 'string' || note.trim().length > 1000 || (action !== 'approve' && note.trim().length < 5)) {
        throw httpError(400, 'Quyết định không hợp lệ; bổ sung hoặc từ chối cần lý do từ 5 đến 1.000 ký tự.');
      }
      return garageTransaction(repository, async (session) => {
        const options = { session };
        const vehicle = await collection('vehicles').findOne({ _id: id }, options);
        if (!vehicle) throw httpError(404, 'Không tìm thấy xe.');
        if (!['submitted', 'pending_review', 'revision_required'].includes(vehicle.onboarding_status) || !['with_owner', 'returned_to_owner'].includes(vehicle.physical_status)) {
          throw httpError(409, 'Xe không còn ở trạng thái chờ xét duyệt. Hãy tải lại hồ sơ.');
        }
        const inspection = await collection('vehicle_inspections').findOne({ vehicle_id: id, inspection_type: 'onboarding' }, { ...options, sort: { created_at: -1, _id: -1 } });
        if (inspection) {
          if (!same(inspection._id, inspectionId) || !Number.isSafeInteger(inspectionVersion) || inspectionVersion !== (inspection.version ?? 0)) {
            throw httpError(409, 'Biên bản kiểm định đã thay đổi. Hãy tải lại hồ sơ trước khi quyết định.');
          }
          if (inspection.approval_status === 'draft') throw httpError(409, 'Garage chưa gửi biên bản kiểm định.');
          // Historical approved reports may support initial approval; a decided failed round cannot be reused.
          if (!['pending', 'approved'].includes(inspection.approval_status)) throw httpError(409, 'Vòng kiểm định đã kết thúc. Cần Garage gửi biên bản mới.');
        } else if (inspectionId || inspectionVersion !== undefined && inspectionVersion !== null) {
          throw httpError(409, 'Biên bản đã thay đổi hoặc không còn tồn tại. Hãy tải lại hồ sơ.');
        }
        if (action === 'approve' && (!inspection || inspection.recommendation !== 'pass')) {
          throw httpError(409, 'Chỉ duyệt xe khi có biên bản kiểm định đầu vào đề xuất đạt.');
        }
        if (action === 'approve' && inspection?.approval_status === 'pending' && inspection.condition_report?.checklist
          && inspection.owner_review?.status !== 'accepted') {
          throw httpError(409, 'Chủ xe cần xác nhận hiện trạng trước khi duyệt hồ sơ.');
        }
        const documentKeys = ['registration', 'inspection_certificate', 'insurance'];
        if (action === 'approve' && vehicle.condition_declaration && documentKeys.some((key) => !vehicle.documents?.[key]?.file_key))
          throw httpError(409, 'Cần đủ đăng ký xe, đăng kiểm và bảo hiểm trước khi duyệt.');
        const now = new Date();
        const verifiedDocuments = action === 'approve' && vehicle.condition_declaration
          ? Object.fromEntries(documentKeys.flatMap((key) => [
            [`documents.${key}.verified`, true],
            [`documents.${key}.review_status`, 'approved'],
            [`documents.${key}.reviewed_at`, now],
          ])) : {};
        if (inspection?.approval_status === 'pending') {
          const changed = await collection('vehicle_inspections').updateOne({ _id: inspection._id, approval_status: 'pending', ...versionFilter(inspection) }, {
            $set: { approval_status: decisions[action], decision_reason: note.trim(), decided_at: now, reviewed_by_manager_id: actorId, updated_at: now },
            $inc: { version: 1 },
          }, options);
          if (changed.modifiedCount !== 1) throw httpError(409, 'Biên bản vừa được xử lý bởi người khác.');
          await audit(actorId, `vehicle.inspection.${action}`, 'vehicle_inspection', inspection._id, { vehicle_id: id, from: 'pending', to: decisions[action], note: note.trim() }, session);
        }
        const changed = await collection('vehicles').updateOne({ _id: id, onboarding_status: vehicle.onboarding_status, physical_status: vehicle.physical_status }, {
          $set: { ...verifiedDocuments, onboarding_status: decisions[action], reviewed_by_manager_id: actorId, review_note: note.trim(), updated_at: now },
          $inc: { inspection_workflow_version: 1 },
          $push: { registration_history: { action: decisions[action], by_user_id: actorId, at: now, note: note.trim() } },
        }, options);
        if (changed.modifiedCount !== 1) throw httpError(409, 'Trạng thái xe vừa thay đổi.');
        await audit(actorId, `vehicle.${action}`, 'vehicles', id, { from: vehicle.onboarding_status, status: decisions[action], inspection_id: inspection?._id, note: note.trim() }, session);
        return { data: { id: String(id), status: decisions[action], inspectionId: inspection?._id, inspectionStatus: inspection?.approval_status === 'pending' ? decisions[action] : inspection?.approval_status } };
      });
    },

    async reviewCompensation({ id: value, body = {}, actorId }) {
      const id = objectId(value);
      const { decision, amount, note = '' } = body;
      if (!id || !['approve', 'reject'].includes(decision) || !Number.isSafeInteger(body.claimIndex) || body.claimIndex < 0 || typeof note !== 'string' || !note.trim() || note.length > 1000 || decision === 'approve' && (!Number.isSafeInteger(amount) || amount < 0)) {
        throw httpError(400, 'Cần quyết định, số tiền hợp lệ và lý do xử lý bồi thường.');
      }
      return garageTransaction(repository, async (session) => {
        const options = { session };
        const incident = await collection('incident_cases').findOne({ _id: id, status: { $in: OPEN_CASES } }, options);
        if (!incident) throw httpError(404, 'Không tìm thấy sự cố đang mở.');
        if (incident.case_type === 'traffic_violation') throw httpError(409, 'Vi phạm giao thông cần xử lý qua quyết định riêng của Manager.');
        const claims = incident.compensation_claims || [];
        const index = claims.findIndex((claim) => !claim.decision || claim.decision === 'pending');
        if (index < 0) throw httpError(409, 'Chưa có đề xuất bồi thường. Cần điều tra và lập đề xuất trước khi duyệt tiền.');
        const claim = claims[index];
        if (body.claimIndex !== index) throw httpError(409, 'Đề xuất đã thay đổi. Hãy tải lại hồ sơ.');
        if (decision === 'approve' && (!Number.isSafeInteger(claim.requested_amount) || amount > Math.min(claim.requested_amount, claim.proposed_amount ?? claim.requested_amount))) throw httpError(400, 'Số tiền duyệt không được vượt đề xuất hợp lệ.');
        const operatorProposal = incident.investigation?.review_status === 'proposed' && Boolean(claim.evidence_basis?.trim());
        const managerReview = incident.status === 'pending_manager'
          && incident.investigation?.review_status === 'submitted'
          && Boolean(incident.submitted_to_manager_by_user_id);
        if (decision === 'approve' && !operatorProposal && !managerReview) {
          throw httpError(409, 'Hồ sơ cần được Operator chuyển Manager trước khi duyệt bồi thường.');
        }
        if (decision === 'approve' && same(incident.assigned_operation_staff_id, actorId)) throw httpError(409, 'Người lập đề xuất không được tự phê duyệt bồi thường.');
        const now = new Date();
        const approved = decision === 'approve' ? amount : 0;
        if (approved > 0) {
          if (!incident.booking_id) throw httpError(409, 'Sự cố chưa gắn chuyến thuê; không được tự khấu trừ cọc khách.');
          const booking = await collection('bookings').findOne({ _id: incident.booking_id, vehicle_id: incident.vehicle_id }, options);
          if (!booking) throw httpError(409, 'Chuyến thuê không khớp xe của sự cố.');
          const deposit = await collection('security_deposits').findOne({ booking_id: incident.booking_id }, options);
          if (!deposit || !Number.isFinite(deposit.refundable_amount) || deposit.refundable_amount < approved) throw httpError(409, 'Cọc có thể hoàn không đủ; chưa thực hiện khấu trừ.');
          const changed = await collection('security_deposits').updateOne({
            _id: deposit._id, refundable_amount: { $gte: approved }, status: { $in: ['collected', 'held', 'pending_refund'] },
            deduction_decisions: { $not: { $elemMatch: { incident_case_id: id, $or: [{ claim_index: index }, { claim_index: { $exists: false } }] } } },
          }, {
            $inc: { deducted_amount: approved, refundable_amount: -approved },
            $push: {
              movements: { type: 'deducted', amount: approved, incident_case_id: id, claim_index: index, at: now },
              deduction_decisions: { incident_case_id: id, claim_index: index, amount: approved, status: 'approved_after_manager_review', approved_by_user_id: actorId, renter_response: claim.renter_response || 'not_received', contract_basis: 'manager_compensation_decision' },
            },
            $set: { updated_at: now },
          }, options);
          if (changed.modifiedCount !== 1) throw httpError(409, 'Cọc đã thay đổi hoặc sự cố đã được khấu trừ.');
        }
        claims[index] = { ...claim, decision: decision === 'approve' ? 'approved' : 'rejected', approved_amount: approved, decision_at: now, reviewed_by_manager_id: actorId, manager_note: note.trim() };
        const complete = claims.every((item) => item.decision && item.decision !== 'pending');
        const changed = await collection('incident_cases').updateOne({ _id: id, status: incident.status, [`compensation_claims.${index}.decision`]: { $in: [null, 'pending'] } }, {
          $set: { [`compensation_claims.${index}`]: claims[index], reviewed_by_manager_id: actorId, updated_at: now,
            ...(complete ? { status: 'resolved', resolution: { outcome: decision === 'approve' ? 'compensation_approved' : 'compensation_rejected', amount: claims.reduce((sum, item) => sum + (item.approved_amount || 0), 0), note: note.trim(), resolved_at: now } } : {}),
          },
        }, options);
        if (changed.modifiedCount !== 1) throw httpError(409, 'Đề xuất vừa được người khác xử lý.');
        await audit(actorId, `compensation.${decision}`, 'incident_cases', id, { amount: approved, note: note.trim() }, session);
        return { data: { id: String(id), decision: claims[index].decision, status: complete ? 'resolved' : incident.status } };
      });
    },

    async reviewIncident({ id: value, body = {}, actorId }) {
      const id = objectId(value);
      const { action, note = '' } = body;
      if (!id) throw httpError(400, 'Hồ sơ sự cố không hợp lệ.');
      if (action === 'request_information') {
        if (typeof note !== 'string' || note.trim().length < 5 || note.trim().length > 1000) {
          throw httpError(400, 'Cần nêu rõ thông tin cần Operator bổ sung (5–1.000 ký tự).');
        }
        return garageTransaction(repository, async (session) => {
          const filter = {
            _id: id,
            status: 'pending_manager',
            submitted_to_manager_by_user_id: { $exists: true },
            'investigation.review_status': 'submitted',
          };
          const incident = await collection('incident_cases').findOne(filter, { session });
          if (!incident) throw httpError(409, 'Chỉ có thể yêu cầu bổ sung khi hồ sơ đang chờ Manager xử lý.');
          const now = new Date();
          const changed = await collection('incident_cases').updateOne(
            { ...filter, updated_at: incident.updated_at ?? { $exists: false } },
            {
              $set: {
                status: 'need_more_information',
                'investigation.review_status': 'needs_information',
                updated_at: now,
              },
              $push: {
                operation_timeline: {
                  action: 'incident.information_requested',
                  status: 'need_more_information',
                  note: note.trim(),
                  actor_user_id: actorId,
                  at: now,
                },
              },
            },
            { session },
          );
          if (changed.modifiedCount !== 1) throw httpError(409, 'Hồ sơ vừa được cập nhật. Hãy tải lại.');
          await audit(actorId, 'incident.request_information', 'incident_cases', id, { note: note.trim() }, session);
          return { data: { id: String(id), status: 'need_more_information' } };
        });
      }
      if (action !== 'resolve' || typeof note !== 'string' || !note.trim() || note.length > 1000) {
        throw httpError(400, 'Cần lý do kết luận sự cố.');
      }
      return garageTransaction(repository, async (session) => {
        const changed = await collection('incident_cases').updateOne({
          _id: id,
          case_type: { $ne: 'traffic_violation' },
          $or: [
            { status: { $in: OPEN_CASES.filter((status) => status !== 'pending_manager') } },
            { status: 'pending_manager', submitted_to_manager_by_user_id: { $exists: true }, 'investigation.review_status': 'submitted' },
          ],
          compensation_claims: { $not: { $elemMatch: { decision: { $in: [null, 'pending'] } } } },
        }, {
          $set: { status: 'resolved', reviewed_by_manager_id: actorId, updated_at: new Date(), resolution: { outcome: 'manager_resolved', note: note.trim(), resolved_at: new Date() } },
        }, { session });
        if (changed.modifiedCount !== 1) throw httpError(409, 'Sự cố đã đóng hoặc còn đề xuất bồi thường chờ duyệt.');
        await audit(actorId, 'incident.resolve', 'incident_cases', id, { note: note.trim() }, session);
        // Closing a financial case never certifies a vehicle as repaired or ready to rent.
        return { data: { id: String(id), status: 'resolved' } };
      });
    },
  };
}
