import { Types } from 'mongoose';
import { httpError, objectId } from '../utils/http-error.js';
import { parseIntakeDraft, parseVersion } from './garage-intake.validator.js';

const { ObjectId } = Types;

export const inspectionChecklistKeys = [
  'identity', 'odometer', 'exterior', 'interior', 'tires', 'brakes',
  'powertrain', 'leaks', 'lights', 'accessories',
];
const checklistResults = ['pass', 'recorded', 'fail', 'unverified', 'not_applicable'];
const optionalChecks = ['accessories'];

function parseChecklist(items, photos) {
  if (!Array.isArray(items) || items.length > inspectionChecklistKeys.length)
    throw httpError(400, 'Checklist kiểm định không hợp lệ.');
  const seen = new Set();
  return items.map((item) => {
    bodyObject(item, ['key', 'result', 'note', 'photo_key']);
    const { key, result, note = '', photo_key = '' } = item;
    if (!inspectionChecklistKeys.includes(key) || seen.has(key) || !checklistResults.includes(result)
      || typeof note !== 'string' || note.length > 500
      || typeof photo_key !== 'string' || (photo_key && !photos.includes(photo_key))
      || (result === 'not_applicable' && !optionalChecks.includes(key)))
      throw httpError(400, 'Mục checklist, kết quả hoặc ảnh tham chiếu không hợp lệ.');
    seen.add(key);
    return { key, result, note: note.trim(), photo_key };
  });
}

export function validateInspectionChecklist(report, recommendation) {
  const items = report.checklist;
  if (items === undefined) return false;
  if (items.length !== inspectionChecklistKeys.length || items.some((item) => item.result === 'unverified'))
    throw httpError(400, 'Cần hoàn tất tất cả mục checklist trước khi gửi.');
  for (const item of items) {
    if (item.result !== 'pass' && !item.note)
      throw httpError(400, 'Cần ghi căn cứ cho từng mục bất thường hoặc không áp dụng.');
    if ((item.result === 'recorded' && !item.photo_key)
      || (item.photo_key && !report.photo_keys?.includes(item.photo_key)))
      throw httpError(400, 'Cần ảnh hiện trạng hợp lệ cho lỗi được ghi nhận.');
    if (item.result === 'recorded' && !['exterior', 'interior', 'accessories'].includes(item.key))
      throw httpError(400, 'Chỉ ghi nhận ngoại lệ nhỏ ở ngoại thất, nội thất hoặc phụ kiện.');
  }
  if (items.some((item) => item.result === 'fail') !== (recommendation !== 'pass'))
    throw httpError(400, 'Kết luận kiểm định phải phù hợp với các mục không đạt.');
  return true;
}

export const inspectionRecommendations = ['pass', 'requires_repair', 'fail'];
export const inspectionStatuses = [
  'draft',
  'pending',
  'approved',
  'revision_required',
  'rejected',
];

function bodyObject(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw httpError(400, 'body phải là object.');
  const unsupported = Object.keys(body).find((key) => !allowed.includes(key));
  if (unsupported)
    throw httpError(400, `Trường không được hỗ trợ: ${unsupported}.`);
}

export function parseInspectionDraft(body, create = false) {
  bodyObject(body, [
    ...(create ? ['vehicleId'] : ['version']),
    'odometerKm',
    'fuelLevelPct',
    'condition',
    'recommendation',
  ]);
  if (!create && !Object.keys(body).some((key) => key !== 'version'))
    throw httpError(400, 'Cần ít nhất một trường để cập nhật bản nháp.');
  if (body.condition !== undefined) {
    bodyObject(body.condition, [
      'exterior',
      'interior',
      'engine',
      'tires',
      'note',
      'photoKeys',
      'checklist',
    ]);
  }
  // Share numeric/condition/key validation with intake; only the validated report fields are retained.
  const { odometer_km, fuel_level_pct, condition_snapshot } = parseIntakeDraft({
    version: 0,
    ...(body.odometerKm !== undefined ? { odometerKm: body.odometerKm } : {}),
    ...(body.fuelLevelPct !== undefined
      ? { fuelLevelPct: body.fuelLevelPct }
      : {}),
    condition: Object.fromEntries(Object.entries(body.condition || {}).filter(([key]) => key !== 'checklist')),
  });
  const result = create
    ? { vehicle_id: new ObjectId(objectId(body.vehicleId, 'vehicleId')) }
    : { version: parseVersion(body.version) };
  const report = { ...condition_snapshot };
  if (body.condition?.checklist !== undefined)
    report.checklist = parseChecklist(body.condition.checklist, report.photo_keys || []);
  if (odometer_km !== undefined) report.odometer_km = odometer_km;
  if (fuel_level_pct !== undefined) report.fuel_level_pct = fuel_level_pct;
  if (Object.keys(report).length) result.condition_report = report;
  if (body.recommendation !== undefined) {
    if (!inspectionRecommendations.includes(body.recommendation))
      throw httpError(
        400,
        'recommendation phải là pass, requires_repair hoặc fail.',
      );
    result.recommendation = body.recommendation;
  }
  return result;
}

export function parseInspectionSubmission(body) {
  bodyObject(body, ['version']);
  return parseVersion(body.version);
}

export function parseInspectionList(query, candidates = false) {
  const scalar = (key, fallback) => {
    if (query[key] === undefined) return fallback;
    if (typeof query[key] !== 'string' || query[key].length > 100)
      throw httpError(400, `${key} không hợp lệ.`);
    return query[key].trim();
  };
  const positive = (key, fallback, max) => {
    const raw = scalar(key, String(fallback));
    const value = Number(raw);
    if (!raw || !Number.isSafeInteger(value) || value < 1 || value > max)
      throw httpError(400, `${key} không hợp lệ.`);
    return value;
  };
  const status = scalar('status', 'all');
  if (
    candidates
      ? status !== 'all'
      : !['all', ...inspectionStatuses].includes(status)
  )
    throw httpError(400, 'status không hợp lệ.');
  const mine = scalar('mine', 'false');
  if (!['true', 'false'].includes(mine) || (candidates && mine !== 'false'))
    throw httpError(
      400,
      'mine phải là true hoặc false, chỉ dùng cho danh sách biên bản.',
    );
  return {
    page: positive('page', 1, 100000),
    limit: positive('limit', 12, 100),
    q: scalar('q', ''),
    status,
    mine: mine === 'true',
  };
}
