import { ObjectId } from 'mongodb';
import { httpError, objectId } from '../../utils/http-error.js';

const caseStatuses = ['open', 'in_progress', 'under_review', 'investigating', 'awaiting_response', 'resolved', 'escalated', 'closed'];
const sortFields = {
  newest: { created_at: -1, _id: -1 },
  oldest: { created_at: 1, _id: 1 },
  start_asc: { start_at: 1, _id: 1 },
  end_asc: { end_at: 1, _id: 1 },
  status: { status: 1, created_at: -1, _id: -1 },
};

function bodyObject(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw httpError(400, 'body phải là object.');
  const unsupported = Object.keys(body).find((key) => !allowed.includes(key));
  if (unsupported) throw httpError(400, `Trường không được hỗ trợ: ${unsupported}.`);
}

function text(value, field, { required = false, max = 500 } = {}) {
  if (typeof value !== 'string') throw httpError(400, `${field} phải là chuỗi.`);
  const result = value.trim();
  if ((required && !result) || result.length > max) throw httpError(400, `${field} không hợp lệ.`);
  return result;
}

function amount(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw httpError(400, `${field} phải là số nguyên không âm.`);
  return value;
}

function queryText(query, key, fallback = '') {
  if (query[key] === undefined) return fallback;
  if (typeof query[key] !== 'string' || query[key].length > 100) throw httpError(400, `${key} không hợp lệ.`);
  return query[key].trim();
}

export function parseOperationListQuery(query, { statuses = [], defaultStatus = 'all' } = {}) {
  const positive = (key, fallback, max) => {
    const raw = queryText(query, key, String(fallback));
    const value = Number(raw);
    if (!raw || !Number.isSafeInteger(value) || value < 1 || value > max) throw httpError(400, `${key} không hợp lệ.`);
    return value;
  };
  const status = queryText(query, 'status', defaultStatus);
  const sort = queryText(query, 'sort', 'newest');
  if (!['all', ...statuses].includes(status)) throw httpError(400, 'status không hợp lệ.');
  if (!Object.hasOwn(sortFields, sort)) throw httpError(400, 'sort không hợp lệ.');
  return { page: positive('page', 1, 100000), limit: positive('limit', 12, 100), q: queryText(query, 'q'), status, sort, sortBy: sortFields[sort] };
}

export function parseBookingDecision(body) {
  bodyObject(body, ['action', 'reason']);
  if (!['approve', 'reject'].includes(body.action)) throw httpError(400, 'action phải là approve hoặc reject.');
  const reason = body.reason === undefined ? '' : text(body.reason, 'reason', { max: 1000 });
  if (body.action === 'reject' && !reason) throw httpError(400, 'Vui lòng nhập lý do từ chối.');
  return { action: body.action, reason };
}

export function parseListingUpdate(body) {
  bodyObject(body, ['title', 'description', 'dailyPrice', 'securityDepositAmount', 'pickupLocation']);
  if (!Object.keys(body).length) throw httpError(400, 'Cần ít nhất một trường để cập nhật tin xe.');
  const update = {};
  if (body.title !== undefined) update.title = text(body.title, 'title', { required: true, max: 160 });
  if (body.description !== undefined) update.description = text(body.description, 'description', { max: 3000 });
  if (body.dailyPrice !== undefined) update.daily_price = amount(body.dailyPrice, 'dailyPrice');
  if (body.securityDepositAmount !== undefined) update.security_deposit_amount = amount(body.securityDepositAmount, 'securityDepositAmount');
  if (body.pickupLocation !== undefined) {
    bodyObject(body.pickupLocation, ['branchName', 'city', 'addressLabel']);
    update.pickup_location = {
      ...(body.pickupLocation.branchName !== undefined ? { branch_name: text(body.pickupLocation.branchName, 'branchName', { required: true, max: 120 }) } : {}),
      ...(body.pickupLocation.city !== undefined ? { city: text(body.pickupLocation.city, 'city', { required: true, max: 100 }) } : {}),
      ...(body.pickupLocation.addressLabel !== undefined ? { address_label: text(body.pickupLocation.addressLabel, 'addressLabel', { max: 300 }) } : {}),
    };
    if (!Object.keys(update.pickup_location).length) throw httpError(400, 'pickupLocation phải có ít nhất một trường.');
  }
  return update;
}

export function parseListingReview(body) {
  bodyObject(body, ['action', 'reason']);
  if (!['approve', 'reject', 'activate', 'deactivate'].includes(body.action)) throw httpError(400, 'action không hợp lệ.');
  const reason = body.reason === undefined ? '' : text(body.reason, 'reason', { max: 1000 });
  if (body.action === 'reject' && !reason) throw httpError(400, 'Vui lòng nhập lý do từ chối.');
  return { action: body.action, reason };
}

export function parseCaseUpdate(body) {
  bodyObject(body, ['status', 'assignedStaffId', 'note', 'evidence', 'compensationProposal']);
  if (!Object.keys(body).length) throw httpError(400, 'Cần ít nhất một trường để cập nhật hồ sơ.');
  const update = {};
  if (body.status !== undefined) {
    if (!caseStatuses.includes(body.status)) throw httpError(400, 'status không hợp lệ.');
    update.status = body.status;
  }
  if (body.assignedStaffId !== undefined)
    update.assigned_operation_staff_id = body.assignedStaffId === null ? null : new ObjectId(objectId(body.assignedStaffId, 'assignedStaffId'));
  if (body.note !== undefined) update.note = text(body.note, 'note', { required: true, max: 2000 });
  if (body.evidence !== undefined) {
    if (!Array.isArray(body.evidence) || body.evidence.length > 20) throw httpError(400, 'evidence phải là danh sách tối đa 20 mục.');
    update.evidence = body.evidence.map((item) => {
      bodyObject(item, ['kind', 'fileKey']);
      return { kind: text(item.kind, 'evidence.kind', { required: true, max: 40 }), file_key: text(item.fileKey, 'evidence.fileKey', { required: true, max: 500 }) };
    });
  }
  if (body.compensationProposal !== undefined) {
    bodyObject(body.compensationProposal, ['amount', 'responsibility', 'note']);
    const responsibility = body.compensationProposal.responsibility;
    if (!['undetermined', 'renter', 'owner', 'garage', 'shared'].includes(responsibility))
      throw httpError(400, 'compensationProposal.responsibility không hợp lệ.');
    update.compensation_proposal = {
      amount: amount(body.compensationProposal.amount, 'compensationProposal.amount'),
      responsibility,
      note: text(body.compensationProposal.note, 'compensationProposal.note', { required: true, max: 2000 }),
    };
  }
  return update;
}

export function parseIncidentCreate(body) {
  bodyObject(body, ['caseType', 'description', 'bookingId', 'vehicleId']);
  const caseType = body.caseType;
  if (!['damage', 'accident', 'safety', 'other', 'overdue', 'traffic_violation'].includes(caseType))
    throw httpError(400, 'caseType không hợp lệ.');
  return {
    case_type: caseType,
    description: text(body.description, 'description', { required: true, max: 3000 }),
    ...(body.bookingId ? { booking_id: new ObjectId(objectId(body.bookingId, 'bookingId')) } : {}),
    ...(body.vehicleId ? { vehicle_id: new ObjectId(objectId(body.vehicleId, 'vehicleId')) } : {}),
  };
}

export function parseViolationDecision(body) {
  bodyObject(body, ['decision', 'penaltyFee', 'note']);
  if (!['confirm', 'reject'].includes(body.decision)) throw httpError(400, 'decision phải là confirm hoặc reject.');
  const note = body.note === undefined ? '' : text(body.note, 'note', { max: 2000 });
  if (body.decision === 'reject' && !note) throw httpError(400, 'Vui lòng nhập lý do từ chối vi phạm.');
  if (body.decision === 'confirm' && body.penaltyFee === undefined) throw httpError(400, 'Vui lòng nhập khoản phạt.');
  return { decision: body.decision, ...(body.penaltyFee !== undefined ? { penalty_fee: amount(body.penaltyFee, 'penaltyFee') } : {}), note };
}

export function parseOverdueAction(body) {
  bodyObject(body, ['action', 'note']);
  if (!['remind', 'handled'].includes(body.action)) throw httpError(400, 'action phải là remind hoặc handled.');
  return { action: body.action, ...(body.note !== undefined ? { note: text(body.note, 'note', { max: 1000 }) } : {}) };
}
