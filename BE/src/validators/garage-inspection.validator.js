import { Types } from 'mongoose';
import { httpError, objectId } from '../utils/http-error.js';
import { parseIntakeDraft, parseVersion } from './garage-intake.validator.js';

const { ObjectId } = Types;

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
    ]);
  }
  // Share numeric/condition/key validation with intake; only the validated report fields are retained.
  const { odometer_km, fuel_level_pct, condition_snapshot } = parseIntakeDraft({
    version: 0,
    ...(body.odometerKm !== undefined ? { odometerKm: body.odometerKm } : {}),
    ...(body.fuelLevelPct !== undefined
      ? { fuelLevelPct: body.fuelLevelPct }
      : {}),
    condition: body.condition || {},
  });
  const result = create
    ? { vehicle_id: new ObjectId(objectId(body.vehicleId, 'vehicleId')) }
    : { version: parseVersion(body.version) };
  const report = { ...condition_snapshot };
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
