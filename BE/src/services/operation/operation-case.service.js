import { httpError } from '../../utils/http-error.js';
import {
  parseCaseUpdate,
  parseIncidentCreate,
  parseOperationListQuery,
  parseViolationDecision,
} from '../../modules/operation/operation.validator.js';
import {
  escapeOperationSearch,
  OPEN_CASES,
  operationPageInfo,
  toOperationId,
} from '../../modules/operation/operation.context.js';

const CASE_TRANSITIONS = {
  open: ['in_progress', 'under_review'],
  reported: ['in_progress', 'under_review'],
  investigating: ['in_progress', 'under_review', 'resolved', 'escalated', 'awaiting_response'],
  in_progress: ['resolved', 'escalated', 'awaiting_response', 'under_review'],
  under_review: ['resolved', 'escalated', 'awaiting_response'],
  awaiting_response: ['in_progress', 'resolved', 'escalated'],
  resolved: ['closed'],
  escalated: ['under_review', 'resolved'],
};

function assertTransition(current, next, isDispute) {
  const source = current === 'investigating' ? 'in_progress' : current;
  const allowed = isDispute && source === 'reported'
    ? ['under_review']
    : CASE_TRANSITIONS[source] || [];
  if (source !== next && !allowed.includes(next)) {
    throw httpError(409, `Không thể chuyển hồ sơ từ ${current} sang ${next}.`);
  }
}

function hasPendingManagerDecision(claims = []) {
  return claims.some((claim) => !claim.decision || claim.decision === 'pending');
}

export function createOperationCaseService(repository, context) {
  const { actorId, audit, caseRows } = context;

  async function listCases(request, type) {
    const query = parseOperationListQuery(request.query, {
      statuses: [
        'reported', 'open', 'investigating', 'in_progress', 'under_review',
        'awaiting_response', 'pending_manager', 'resolved', 'escalated', 'closed',
      ],
    });
    const filter = type === 'incident'
      ? { case_type: { $nin: ['traffic_violation', 'dispute', 'complaint'] } }
      : type ? { case_type: type } : {};
    if (query.status !== 'all') filter.status = query.status;
    if (query.q) {
      filter.$or = [
        { case_number: { $regex: escapeOperationSearch(query.q), $options: 'i' } },
        { description: { $regex: escapeOperationSearch(query.q), $options: 'i' } },
      ];
    }

    const sortBy = query.sortBy.updated_at
      ? { updated_at: query.sortBy.updated_at, _id: query.sortBy._id }
      : query.sortBy;
    const [rows, total] = await Promise.all([
      repository.findMany('incident_cases', filter, { ...query, sortBy }),
      repository.count('incident_cases', filter),
    ]);
    return {
      data: await caseRows(rows),
      pagination: operationPageInfo(query.page, query.limit, total),
    };
  }

  async function listStaff() {
    const roles = await repository.collection('roles')
      .find({ code: { $in: ['OPERATION_STAFF', 'ADMIN'] } })
      .project({ _id: 1, code: 1 })
      .toArray();
    const roleIds = roles.map((role) => role._id);
    if (!roleIds.length) return { data: [] };
    const roleMap = new Map(roles.map((role) => [role._id.toString(), role.code]));
    const users = await repository.collection('users')
      .find({
        account_status: 'active',
        $or: [
          { primary_role_id: { $in: roleIds } },
          { additional_role_ids: { $in: roleIds } },
        ],
      })
      .project({ full_name: 1, email: 1, phone: 1, primary_role_id: 1 })
      .sort({ full_name: 1 })
      .toArray();
    return {
      data: users.map((user) => ({
        id: user._id.toString(),
        name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: roleMap.get(user.primary_role_id?.toString()) || 'OPERATION_STAFF',
      })),
    };
  }

  async function createIncident(request, body) {
    const input = parseIncidentCreate(body);
    if (input.booking_id && !(await repository.findById('bookings', input.booking_id))) {
      throw httpError(404, 'Không tìm thấy booking được liên kết.');
    }
    if (input.vehicle_id && !(await repository.findById('vehicles', input.vehicle_id))) {
      throw httpError(404, 'Không tìm thấy xe được liên kết.');
    }

    const now = new Date();
    const id = new ObjectId();
    const document = {
      _id: id,
      case_number: `CASE-${now.getFullYear()}-${id.toString().slice(-8).toUpperCase()}`,
      reported_by_user_id: actorId(request),
      assigned_operation_staff_id: actorId(request),
      ...input,
      evidence: [],
      investigation: { review_status: 'pending', findings: '', estimated_cost: 0 },
      ...(input.case_type === 'traffic_violation'
        ? {
          traffic_violation_details: {
            reported_at: now,
            official_confirmation: 'not_confirmed',
            fine_amount_claimed: 0,
          },
        }
        : { traffic_violation_details: null }),
      compensation_claims: [],
      status: 'reported',
      created_at: now,
      updated_at: now,
      operation_timeline: [{
        action: 'incident.created',
        note: '',
        actor_user_id: actorId(request),
        at: now,
      }],
    };
    await repository.insertOne('incident_cases', document);
    await audit(request, 'incident.create', 'incident_cases', id, { caseType: input.case_type });
    return { data: { id: id.toString(), caseNumber: document.case_number, status: document.status } };
  }

  async function updateCase(request, idValue, body, expectedType) {
    const id = toOperationId(idValue);
    const changes = parseCaseUpdate(body);
    const current = await repository.findById('incident_cases', id);
    if (!current || (expectedType && current.case_type !== expectedType)) {
      throw httpError(404, 'Không tìm thấy hồ sơ.');
    }
    if (changes.compensation_proposal && changes.status !== undefined) {
      throw httpError(400, 'Không thể gửi đề xuất Manager cùng lúc đổi trạng thái.');
    }
    if (changes.status !== undefined) {
      if (current.status === 'pending_manager') {
        throw httpError(409, 'Hồ sơ đang chờ Manager quyết định.');
      }
      if (current.case_type === 'dispute' && ['resolved', 'closed'].includes(changes.status)) {
        throw httpError(403, 'Tranh chấp chỉ được đóng sau quyết định của Manager.');
      }
      if (hasPendingManagerDecision(current.compensation_claims)
        && ['resolved', 'closed'].includes(changes.status)) {
        throw httpError(403, 'Operation không được đóng hồ sơ còn quyết định bồi thường chờ Manager.');
      }
      assertTransition(current.status, changes.status, current.case_type === 'dispute');
    }

    if (changes.assigned_operation_staff_id) {
      const assignee = await repository.collection('users').findOne({
        _id: changes.assigned_operation_staff_id,
        account_status: 'active',
      });
      if (!assignee) throw httpError(404, 'Không tìm thấy nhân sự đang hoạt động.');
      const roleIds = [assignee.primary_role_id, ...(assignee.additional_role_ids || [])].filter(Boolean);
      const roles = await repository.collection('roles')
        .find({ _id: { $in: roleIds } })
        .project({ code: 1 })
        .toArray();
      if (!roles.some(({ code }) => ['OPERATION_STAFF', 'ADMIN'].includes(code))) {
        throw httpError(400, 'Chỉ có thể phân công cho Operation Staff hoặc Admin.');
      }
    }

    const now = new Date();
    const actor = actorId(request);
    const set = { updated_at: now, handled_by: actor, handled_at: now };
    const push = {};
    const timeline = [];

    if (changes.status !== undefined) {
      set.status = changes.status;
      timeline.push({
        action: 'status.update',
        status: changes.status,
        note: changes.note || '',
        actor_user_id: actor,
        at: now,
      });
    }
    if (changes.assigned_operation_staff_id !== undefined) {
      set.assigned_operation_staff_id = changes.assigned_operation_staff_id;
      timeline.push({
        action: 'case.assign',
        note: changes.note || '',
        actor_user_id: actor,
        at: now,
      });
    }
    if (changes.evidence?.length) {
      push.evidence = {
        $each: changes.evidence.map((item) => ({
          ...item,
          uploaded_by_user_id: actor,
          uploaded_at: now,
        })),
      };
      timeline.push({
        action: 'case.evidence',
        note: `${changes.evidence.length} tệp chứng cứ`,
        actor_user_id: actor,
        at: now,
      });
    }
    if (changes.note && changes.status === undefined && changes.assigned_operation_staff_id === undefined) {
      timeline.push({ action: 'case.note', note: changes.note, actor_user_id: actor, at: now });
    }
    if (changes.status !== undefined && ['complaint', 'dispute'].includes(current.case_type)) {
      set['investigation.review_status'] = changes.status;
    }
    if (changes.status === 'resolved' || changes.status === 'closed') {
      set.resolution = {
        ...(current.resolution || {}),
        outcome: changes.status,
        note: changes.note || '',
        resolved_at: now,
      };
    }

    if (changes.compensation_proposal) {
      if (current.case_type === 'traffic_violation') {
        throw httpError(400, 'Hồ sơ vi phạm phải gửi qua luồng đề xuất vi phạm.');
      }
      if (current.status === 'pending_manager' || hasPendingManagerDecision(current.compensation_claims)) {
        throw httpError(409, 'Hồ sơ đã có đề xuất đang chờ Manager.');
      }
      const proposal = changes.compensation_proposal;
      const claim = {
        requested_amount: proposal.amount,
        proposed_amount: proposal.amount,
        decision: 'pending',
        operation_proposal: {
          responsibility: proposal.responsibility,
          note: proposal.note,
          submitted_by_user_id: actor,
          submitted_at: now,
        },
      };
      set.status = 'pending_manager';
      set['investigation.review_status'] = 'pending_manager';
      set['investigation.responsibility_proposal'] = proposal.responsibility;
      set['investigation.estimated_cost'] = proposal.amount;
      push.compensation_claims = claim;
      timeline.push({
        action: 'case.proposal_submitted',
        status: 'pending_manager',
        note: proposal.note,
        actor_user_id: actor,
        at: now,
      });
    }
    if (timeline.length) push.operation_timeline = { $each: timeline };

    const result = await repository.updateOne(
      'incident_cases',
      { _id: id, status: current.status },
      { $set: set, ...(Object.keys(push).length ? { $push: push } : {}) },
    );
    if (!result.modifiedCount) {
      throw httpError(409, 'Hồ sơ vừa được cập nhật. Vui lòng tải lại.');
    }
    await audit(request, 'case.update', 'incident_cases', id, {
      status: set.status || current.status,
      proposalSubmitted: Boolean(changes.compensation_proposal),
    });
    return { data: { id: id.toString(), status: set.status || current.status } };
  }

  async function proposeViolationReview(request, idValue, body) {
    const id = toOperationId(idValue);
    const recommendation = parseViolationDecision(body);
    const current = await repository.findById('incident_cases', id);
    if (!current || current.case_type !== 'traffic_violation') {
      throw httpError(404, 'Không tìm thấy vi phạm.');
    }
    if (!OPEN_CASES.includes(current.status) || current.status === 'pending_manager') {
      throw httpError(409, 'Vi phạm không còn ở trạng thái chờ Operation xử lý.');
    }
    if (hasPendingManagerDecision(current.compensation_claims)) {
      throw httpError(409, 'Vi phạm đã có đề xuất đang chờ Manager.');
    }

    const now = new Date();
    const actor = actorId(request);
    const proposedAmount = recommendation.decision === 'confirm' ? recommendation.penalty_fee : 0;
    const claim = {
      requested_amount: current.traffic_violation_details?.fine_amount_claimed || proposedAmount,
      proposed_amount: proposedAmount,
      decision: 'pending',
      operation_proposal: {
        recommendation: recommendation.decision,
        responsibility: 'renter',
        note: recommendation.note,
        submitted_by_user_id: actor,
        submitted_at: now,
      },
    };
    const result = await repository.updateOne(
      'incident_cases',
      { _id: id, status: current.status },
      {
        $set: {
          status: 'pending_manager',
          updated_at: now,
          handled_by: actor,
          handled_at: now,
          'investigation.review_status': 'pending_manager',
          'traffic_violation_details.reviewed_by_operation_staff_id': actor,
          'traffic_violation_details.reviewed_at': now,
        },
        $push: {
          compensation_claims: claim,
          operation_timeline: {
            action: 'violation.proposal_submitted',
            note: recommendation.note,
            actor_user_id: actor,
            at: now,
          },
        },
      },
    );
    if (!result.modifiedCount) throw httpError(409, 'Vi phạm vừa được cập nhật. Vui lòng tải lại.');
    await audit(request, 'violation.proposal', 'incident_cases', id, {
      recommendation: recommendation.decision,
      proposedAmount,
    });
    return { data: { id: id.toString(), status: 'pending_manager', recommendation: recommendation.decision } };
  }

  async function getCase(idValue, expectedType) {
    const row = await repository.findById('incident_cases', toOperationId(idValue));
    if (!row || (expectedType && row.case_type !== expectedType)) {
      throw httpError(404, 'Không tìm thấy hồ sơ.');
    }
    return { data: (await caseRows([row]))[0] };
  }

  return {
    createIncident,
    getCase,
    listComplaints: (request) => listCases(request, 'complaint'),
    listDisputes: (request) => listCases(request, 'dispute'),
    listIncidents: (request) => listCases(request, 'incident'),
    listStaff,
    listViolations: (request) => listCases(request, 'traffic_violation'),
    proposeViolationReview,
    updateCase,
  };
}
