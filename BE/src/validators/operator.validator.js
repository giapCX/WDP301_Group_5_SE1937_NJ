import { Types } from 'mongoose';
import { httpError, objectId } from '../utils/http-error.js';
import { parsePaging } from '../utils/pagination.js';

const physicalStatuses = new Set(['with_owner', 'at_garage', 'rented', 'returned_to_owner', 'maintenance']);
const caseTypes = new Set(['vehicle_damage', 'traffic_violation', 'theft', 'other', 'damage', 'accident', 'safety', 'overdue']);
const severities = new Set(['low', 'medium', 'high']);
const operatorCaseStatuses = new Set(['reported', 'open', 'investigating', 'in_progress', 'under_review', 'awaiting_response', 'need_more_information']);
const allowedEvidenceTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function objectBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'body phải là object.');
  const unsupported = Object.keys(body).find((key) => !allowed.includes(key));
  if (unsupported) throw httpError(400, `Trường không được hỗ trợ: ${unsupported}.`);
}

function text(value, field, { required = false, max = 500 } = {}) {
  if (typeof value !== 'string') throw httpError(400, `${field} phải là chuỗi.`);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > max) throw httpError(400, `${field} không hợp lệ.`);
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
    ...(body.note !== undefined ? { note: text(body.note, 'note', { max: 1000 }) } : {}),
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

export function parseIncidentCreate(body) {
  objectBody(body, ['caseType', 'description', 'vehicleId', 'bookingId', 'incidentType', 'location', 'odometerKm', 'severity']);
  if (!caseTypes.has(body.caseType)) throw httpError(400, 'caseType không hợp lệ.');
  const description = text(body.description, 'description', { required: true, max: 3000 });
  const vehicleId = objectId(body.vehicleId, 'vehicleId');
  const bookingId = body.bookingId === undefined ? null : objectId(body.bookingId, 'bookingId');
  if (body.severity !== undefined && !severities.has(body.severity)) throw httpError(400, 'severity không hợp lệ.');
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
  };
}

export function parseIncidentUpdate(body) {
  objectBody(body, ['description', 'incidentType', 'location', 'odometerKm', 'severity', 'status', 'note']);
  if (!Object.keys(body).length) throw httpError(400, 'Cần ít nhất một trường để cập nhật hồ sơ.');
  const update = {};
  if (body.description !== undefined) update.description = text(body.description, 'description', { required: true, max: 3000 });
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
  if (body.status !== undefined) {
    if (!operatorCaseStatuses.has(body.status)) throw httpError(400, 'Operator chỉ được cập nhật trạng thái ghi nhận/điều tra.');
    update.status = body.status;
  }
  if (body.note !== undefined) update.note = text(body.note, 'note', { required: true, max: 2000 });
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
