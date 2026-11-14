import { Types } from 'mongoose';
import { httpError, objectId } from '../utils/http-error.js';
import { parsePaging } from '../utils/pagination.js';

const physicalStatuses = new Set(['with_owner', 'at_garage', 'rented', 'returned_to_owner', 'maintenance']);
const caseTypes = new Set(['vehicle_damage', 'traffic_violation', 'theft', 'other', 'damage', 'accident', 'safety', 'overdue']);
const severities = new Set(['low', 'medium', 'high']);
const allowedEvidenceTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function objectBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'body phải là object.');
  const unsupported = Object.keys(body).find((key) => !allowed.includes(key));
  if (unsupported) throw httpError(400, `Trường không được hỗ trợ: ${unsupported}.`);
}

function text(value, field, { required = false, min = 0, max = 500 } = {}) {
  if (typeof value !== 'string') throw httpError(400, `${field} phải là chuỗi.`);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length < min || normalized.length > max) throw httpError(400, `${field} không hợp lệ.`);
  return normalized;
}

function location(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90
    || !Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) {
    throw httpError(400, 'location cần latitude và longitude hợp lệ.');
  }
  return { latitude: value.latitude, longitude: value.longitude };
}

export function parseOperatorListQuery(query, statuses = []) {
  const paging = parsePaging(query);
  const q = query.q ?? '';
  const status = query.status ?? 'all';
  if (typeof q !== 'string' || q.length > 100) throw httpError(400, 'q không hợp lệ.');
  if (typeof status !== 'string' || !['all', ...statuses].includes(status)) throw httpError(400, 'status không hợp lệ.');
  return { ...paging, q: q.trim(), status };
}

export function parseVehicleStatusUpdate(body) {
  objectBody(body, ['status', 'note']);
  if (!physicalStatuses.has(body.status)) throw httpError(400, 'Trạng thái vận hành không hợp lệ.');
  return {
    status: body.status,
    note: text(body.note, 'note', { required: true, min: 5, max: 1000 }),
  };
}

export function parseVehicleInspectionAssignment(body) {
  objectBody(body, ['garageStaffId', 'scheduledFor', 'note']);
  const garageStaffId = new Types.ObjectId(objectId(body.garageStaffId, 'garageStaffId'));
  if (typeof body.scheduledFor !== 'string' || Number.isNaN(Date.parse(body.scheduledFor))) {
    throw httpError(400, 'scheduledFor phải là thời gian ISO 8601 hợp lệ.');
  }
  const scheduledFor = new Date(body.scheduledFor);
  if (scheduledFor <= new Date()) throw httpError(400, 'Lịch kiểm định phải ở tương lai.');
  return {
    garageStaffId,
    scheduledFor,
    note: text(body.note, 'note', { required: true, max: 1000 }),
  };
}

export function parseVehicleInspectionReschedule(body) {
  objectBody(body, ['garageStaffId', 'scheduledFor', 'note', 'version']);
  if (!Number.isSafeInteger(body.version) || body.version < 0) {
    throw httpError(400, 'version phải là số nguyên không âm.');
  }
  const { version, ...assignment } = body;
  return { ...parseVehicleInspectionAssignment(assignment), version };
}

export function parseIncidentCreate(body) {
  objectBody(body, ['caseType', 'description', 'vehicleId', 'bookingId', 'incidentType', 'location', 'odometerKm', 'severity', 'vehicleSeized']);
  if (!caseTypes.has(body.caseType)) throw httpError(400, 'caseType không hợp lệ.');
  const description = text(body.description, 'description', { required: true, max: 3000 });
  const vehicleId = objectId(body.vehicleId, 'vehicleId');
  const bookingId = body.bookingId === undefined ? null : objectId(body.bookingId, 'bookingId');
  if (body.severity !== undefined && !severities.has(body.severity)) throw httpError(400, 'severity không hợp lệ.');
  if (body.vehicleSeized !== undefined && typeof body.vehicleSeized !== 'boolean') throw httpError(400, 'vehicleSeized phải là giá trị boolean.');
  if (body.odometerKm !== undefined && (!Number.isSafeInteger(body.odometerKm) || body.odometerKm < 0)) {
    throw httpError(400, 'odometerKm phải là số nguyên không âm.');
  }
  return {
    caseType: body.caseType,
    description,
    vehicleId,
    bookingId,
    ...(body.incidentType !== undefined ? { incidentType: text(body.incidentType, 'incidentType', { max: 80 }) } : {}),
    ...(body.location !== undefined ? { location: location(body.location) } : {}),
    ...(body.odometerKm !== undefined ? { odometerKm: body.odometerKm } : {}),
    ...(body.severity !== undefined ? { severity: body.severity } : {}),
    ...(body.vehicleSeized !== undefined ? { vehicleSeized: body.vehicleSeized } : {}),
  };
}

export function parseIncidentUpdate(body) {
  objectBody(body, ['description', 'bookingId', 'incidentType', 'location', 'odometerKm', 'severity', 'vehicleSeized', 'note', 'responseChecklist', 'expense']);
  if (!Object.keys(body).length) throw httpError(400, 'Cần ít nhất một trường để cập nhật hồ sơ.');
  const update = {};
  if (body.description !== undefined) update.description = text(body.description, 'description', { required: true, max: 3000 });
  if (body.bookingId !== undefined) {
    update.booking_id = body.bookingId === null
      ? null
      : new Types.ObjectId(objectId(body.bookingId, 'bookingId'));
  }
  if (body.incidentType !== undefined) update.incident_type = text(body.incidentType, 'incidentType', { max: 80 });
  if (body.location !== undefined) update.location = location(body.location);
  if (body.odometerKm !== undefined) {
    if (!Number.isSafeInteger(body.odometerKm) || body.odometerKm < 0) throw httpError(400, 'odometerKm phải là số nguyên không âm.');
    update.odometer_km = body.odometerKm;
  }
  if (body.severity !== undefined) {
    if (!severities.has(body.severity)) throw httpError(400, 'severity không hợp lệ.');
    update.severity = body.severity;
  }
  if (body.vehicleSeized !== undefined) {
    if (typeof body.vehicleSeized !== 'boolean') throw httpError(400, 'vehicleSeized phải là giá trị boolean.');
    update.vehicle_seized = body.vehicleSeized;
  }
  if (body.note !== undefined) update.note = text(body.note, 'note', { required: true, max: 2000 });
  if (body.responseChecklist !== undefined) {
    const checklist = body.responseChecklist;
    const limits = { driverName: 120, policeReference: 120, insurerReference: 120, missingDocuments: 1000,
      fieldResponder: 120, driverVerification: 1000, detentionProgress: 1000, insuranceProgress: 1000, repairProgress: 1000 };
    const dates = ['ownerNotifiedAt', 'insurerNotifiedAt'];
    objectBody(checklist, [...Object.keys(limits), ...dates, 'injuryStatus']);
    for (const [key, max] of Object.entries(limits)) {
      if (checklist[key] !== undefined) update[`response_checklist.${key}`] = text(checklist[key], key, { max });
    }
    for (const key of dates) {
      if (checklist[key] === undefined) continue;
      const value = checklist[key];
      if (value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.now())) {
        throw httpError(400, 'Thời điểm thông báo phải hợp lệ và không ở tương lai.');
      }
      update[`response_checklist.${key}`] = value === null ? null : new Date(value);
    }
    if (checklist.injuryStatus !== undefined) {
      if (!['unknown', 'none', 'reported'].includes(checklist.injuryStatus)) throw httpError(400, 'Tình trạng thương tích không hợp lệ.');
      update['response_checklist.injuryStatus'] = checklist.injuryStatus;
    }
  }
  if (body.expense !== undefined) {
    const { category, amount, insuranceAmount, evidence, settlementParty } = body.expense || {};
    objectBody(body.expense, ['category', 'amount', 'insuranceAmount', 'evidence', 'settlementParty']);
    if (settlementParty !== undefined && !['owner_payable', 'renter_receivable', 'third_party_payable'].includes(settlementParty))
      throw httpError(400, 'Bên đối soát không hợp lệ.');
    if (!['assessment', 'repair', 'deductible', 'towing', 'other'].includes(category)
      || !Number.isSafeInteger(amount) || amount < 1 || amount > 1e9
      || !Number.isSafeInteger(insuranceAmount) || insuranceAmount < 0 || insuranceAmount > amount) {
      throw httpError(400, 'Khoản chi hoặc phần bảo hiểm chấp nhận không hợp lệ.');
    }
    update.expense = { category, settlement_party: settlementParty, requested_amount: amount, insurance_amount: insuranceAmount,
      proposed_amount: amount - insuranceAmount, decision: 'pending',
      evidence_basis: text(evidence, 'Chứng từ', { required: true, max: 500 }) };
  }
  return update;
}

export function parseIncidentEvidence(body) {
  objectBody(body, ['file']);
  const file = body.file;
  if (!file || typeof file !== 'object' || typeof file.name !== 'string'
    || typeof file.contentType !== 'string' || typeof file.data !== 'string') {
    throw httpError(400, 'Vui lòng đính kèm biên bản.');
  }
  if (!allowedEvidenceTypes.has(file.contentType)) throw httpError(400, 'Chỉ nhận PDF, JPEG, PNG hoặc WebP.');
  const name = text(file.name, 'file.name', { required: true, max: 120 });
  const base64 = file.data.replace(/^data:[^,]+;base64,/, '');
  if (!base64 || !/^[A-Za-z\d+/]*={0,2}$/.test(base64)) throw httpError(400, 'Tệp đính kèm không hợp lệ.');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw httpError(400, 'Tệp đính kèm không được vượt quá 4 MB.');
  return { name, contentType: file.contentType, bytes };
}
