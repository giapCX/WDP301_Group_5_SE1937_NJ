import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';
import { garageTransaction } from '../utils/garage-transaction.js';

const OPEN_CASES = ['reported', 'open', 'investigating', 'pending_review', 'awaiting_response'];
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
    async proposeCompensation({ id: value, body = {}, actorId }) {
      const id = objectId(value);
      const { amount, evidenceBasis, renterResponse } = body;
      if (!id || !Number.isSafeInteger(amount) || amount <= 0 || typeof evidenceBasis !== 'string' || evidenceBasis.trim().length < 10 || evidenceBasis.length > 3000 || !['agreed', 'disputed', 'not_received'].includes(renterResponse)) {
        throw httpError(400, 'Đề xuất cần số tiền, căn cứ tối thiểu 10 ký tự và trạng thái phản hồi thực tế của khách.');
      }
      return garageTransaction(repository, async (session) => {
        const incident = await collection('incident_cases').findOne({ _id: id, status: { $in: OPEN_CASES } }, { session });
        if (!incident) throw httpError(404, 'Không tìm thấy sự cố đang mở.');
        if (!incident.booking_id || !await collection('bookings').findOne({ _id: incident.booking_id, vehicle_id: incident.vehicle_id }, { session })) {
          throw httpError(409, 'Chưa xác định được chuyến thuê phù hợp; không lập đề xuất khấu trừ cọc khách.');
        }
        const pendingIndex = (incident.compensation_claims || []).findIndex((claim) => !claim.decision || claim.decision === 'pending');
        if (pendingIndex >= 0 && (body.claimIndex !== pendingIndex || incident.investigation?.review_status === 'proposed')) throw httpError(409, 'Cần chỉ rõ yêu cầu đang điều tra; đề xuất đã gửi Manager không được sửa.');
        const previousClaim = pendingIndex >= 0 ? incident.compensation_claims[pendingIndex] : null;
        if (previousClaim && amount > previousClaim.requested_amount) throw httpError(400, 'Đề xuất không được vượt số tiền yêu cầu.');
        const proposal = { ...(previousClaim || {}), requested_amount: previousClaim?.requested_amount ?? amount, proposed_amount: amount, decision: 'pending', evidence_basis: evidenceBasis.trim(), renter_response: renterResponse };
        const now = new Date();
        const changed = await collection('incident_cases').updateOne({ _id: id, status: incident.status }, {
          ...(pendingIndex < 0 ? { $push: { compensation_claims: proposal } } : {}),
          $set: { ...(pendingIndex >= 0 ? { [`compensation_claims.${pendingIndex}`]: proposal } : {}), status: 'pending_review', assigned_operation_staff_id: actorId, 'investigation.review_status': 'proposed', 'investigation.renter_response': renterResponse, updated_at: now },
        }, { session });
        if (changed.modifiedCount !== 1) throw httpError(409, 'Hồ sơ sự cố vừa thay đổi.');
        await audit(actorId, 'incident.compensation_proposed', 'incident_cases', id, { amount, renter_response: renterResponse }, session);
        return { data: { id: String(id), status: 'pending_review' } };
      });
    },
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
        const now = new Date();
        if (inspection?.approval_status === 'pending') {
          const changed = await collection('vehicle_inspections').updateOne({ _id: inspection._id, approval_status: 'pending', ...versionFilter(inspection) }, {
            $set: { approval_status: decisions[action], decision_reason: note.trim(), decided_at: now, reviewed_by_manager_id: actorId, updated_at: now },
            $inc: { version: 1 },
          }, options);
          if (changed.modifiedCount !== 1) throw httpError(409, 'Biên bản vừa được xử lý bởi người khác.');
          await audit(actorId, `vehicle.inspection.${action}`, 'vehicle_inspection', inspection._id, { vehicle_id: id, from: 'pending', to: decisions[action], note: note.trim() }, session);
        }
        const changed = await collection('vehicles').updateOne({ _id: id, onboarding_status: vehicle.onboarding_status, physical_status: vehicle.physical_status }, {
          $set: { onboarding_status: decisions[action], reviewed_by_manager_id: actorId, review_note: note.trim(), updated_at: now },
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
        const claims = incident.compensation_claims || [];
        const index = claims.findIndex((claim) => !claim.decision || claim.decision === 'pending');
        if (index < 0) throw httpError(409, 'Chưa có đề xuất bồi thường. Cần điều tra và lập đề xuất trước khi duyệt tiền.');
        const claim = claims[index];
        if (body.claimIndex !== index) throw httpError(409, 'Đề xuất đã thay đổi. Hãy tải lại hồ sơ.');
        if (decision === 'approve' && (!Number.isSafeInteger(claim.requested_amount) || amount > Math.min(claim.requested_amount, claim.proposed_amount ?? claim.requested_amount))) throw httpError(400, 'Số tiền duyệt không được vượt đề xuất hợp lệ.');
        if (decision === 'approve' && (incident.investigation?.review_status !== 'proposed' || !claim.evidence_basis?.trim())) throw httpError(409, 'Cần Operation xác minh và lập đề xuất có căn cứ trước khi duyệt bồi thường.');
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
      if (!id || action !== 'resolve' || typeof note !== 'string' || !note.trim() || note.length > 1000) throw httpError(400, 'Cần lý do kết luận sự cố.');
      return garageTransaction(repository, async (session) => {
        const changed = await collection('incident_cases').updateOne({ _id: id, status: { $in: OPEN_CASES }, compensation_claims: { $not: { $elemMatch: { decision: { $in: [null, 'pending'] } } } } }, {
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
