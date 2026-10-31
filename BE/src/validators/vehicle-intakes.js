import { ObjectId } from 'mongodb';
import { httpError, objectId } from '../utils/http-error.js';

function plain(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw httpError(400, `${name} phải là object.`);
}
function keys(value, allowed) {
  const unsupported = Object.keys(value).find((key) => !allowed.includes(key));
  if (unsupported)
    throw httpError(400, `Trường không được hỗ trợ: ${unsupported}.`);
}
function integer(value, field, max) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw httpError(400, `${field} phải là số nguyên từ 0 đến ${max}.`);
  return value;
}
export function parseVersion(value) {
  return integer(value, 'version', Number.MAX_SAFE_INTEGER);
}
export function parseIntakeDraft(body, create = false) {
  plain(body, 'body');
  keys(body, [
    ...(create ? ['vehicleId', 'managementAgreementId'] : ['version']),
    'odometerKm',
    'fuelLevelPct',
    'condition',
  ]);
  if (!create && !Object.keys(body).some((key) => key !== 'version'))
    throw httpError(400, 'Cần ít nhất một trường để cập nhật bản nháp.');
  const output = {};
  if (create) {
    output.vehicle_id = new ObjectId(objectId(body.vehicleId, 'vehicleId'));
    output.management_agreement_id = new ObjectId(
      objectId(body.managementAgreementId, 'managementAgreementId'),
    );
  } else output.version = parseVersion(body.version);
  if (body.odometerKm !== undefined)
    output.odometer_km = integer(body.odometerKm, 'odometerKm', 10000000);
  if (body.fuelLevelPct !== undefined)
    output.fuel_level_pct = integer(body.fuelLevelPct, 'fuelLevelPct', 100);
  if (body.condition !== undefined) {
    plain(body.condition, 'condition');
    keys(body.condition, [
      'exterior',
      'interior',
      'engine',
      'tires',
      'note',
      'accessories',
      'photoKeys',
    ]);
    output.condition_snapshot = {};
    for (const field of ['exterior', 'interior', 'engine', 'tires']) {
      if (body.condition[field] === undefined) continue;
      if (!['good', 'attention', 'damaged'].includes(body.condition[field]))
        throw httpError(
          400,
          `condition.${field} phải là good, attention hoặc damaged.`,
        );
      output.condition_snapshot[field] = body.condition[field];
    }
    if (body.condition.note !== undefined) {
      if (
        typeof body.condition.note !== 'string' ||
        body.condition.note.length > 1500
      )
        throw httpError(400, 'Ghi chú tối đa 1500 ký tự.');
      output.condition_snapshot.note = body.condition.note.trim();
    }
    for (const [input, stored, max] of [
      ['accessories', 'accessories', 20],
      ['photoKeys', 'photo_keys', 4],
    ]) {
      const values = body.condition[input];
      if (values === undefined) continue;
      if (
        !Array.isArray(values) ||
        values.length > max ||
        values.some(
          (value) =>
            typeof value !== 'string' || !value.trim() || value.length > 250,
        )
      )
        throw httpError(
          400,
          `condition.${input} phải là danh sách chuỗi, tối đa ${max} mục.`,
        );
      if (
        input === 'photoKeys' &&
        values.some(
          (value) =>
            !/^[a-z\d][a-z\d/_.-]*$/i.test(value) || value.includes('..'),
        )
      )
        throw httpError(
          400,
          'photoKeys phải là khóa ảnh, không nhận URL hoặc base64.',
        );
      output.condition_snapshot[stored] = [
        ...new Set(values.map((value) => value.trim())),
      ];
    }
  }
  return output;
}
export function parseConfirmation(body) {
  plain(body, 'body');
  keys(body, ['version', 'ownerConfirmed']);
  const version = parseVersion(body.version);
  if (body.ownerConfirmed !== true)
    throw httpError(400, 'Cần ghi nhận xác nhận bàn giao của chủ xe.');
  return { version };
}
export function parseIntakeList(query) {
  const scalar = (key, fallback, max = 100) => {
    if (query[key] === undefined) return fallback;
    if (typeof query[key] !== 'string' || query[key].length > max)
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
  if (!['all', 'draft', 'completed'].includes(status))
    throw httpError(400, 'status phải là all, draft hoặc completed.');
  return {
    page: positive('page', 1, 100000),
    limit: positive('limit', 12, 100),
    q: scalar('q', ''),
    status,
  };
}
