import { Types } from 'mongoose';
import { parseIntakeDraft, parseVersion } from './garage-intake.validator.js';
import { httpError, objectId } from '../utils/http-error.js';

export function parseHandover(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Body không hợp lệ.');
  const allowed = ['odometerKm', 'fuelLevelPct', 'condition', ...(creating ? ['bookingId', 'type'] : ['version'])];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw httpError(400, 'Biên bản chứa trường không được hỗ trợ.');
  const report = Object.fromEntries(['odometerKm', 'fuelLevelPct', 'condition'].filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
  const parsed = parseIntakeDraft({ version: creating ? 0 : body.version, ...report, ...(!Object.keys(report).length && creating ? { condition: {} } : {}) });
  const { condition_snapshot, version, ...values } = parsed;
  return {
    ...values, ...(condition_snapshot ? { vehicle_condition: condition_snapshot } : {}),
    ...(creating ? { booking_id: new Types.ObjectId(objectId(body.bookingId, 'bookingId')), handover_type: handoverType(body.type) } : { version }),
  };
}
export function handoverType(value) {
  if (!['pickup', 'return'].includes(value)) throw httpError(400, 'Loại giao nhận phải là pickup hoặc return.');
  return value;
}
export function parseHandoverConfirmation(body) {
  if (!body || Object.keys(body).some((key) => !['version', 'renterConfirmed'].includes(key)) || body.renterConfirmed !== true) {
    throw httpError(400, 'Cần ghi nhận xác nhận của khách thuê.');
  }
  return parseVersion(body.version);
}
