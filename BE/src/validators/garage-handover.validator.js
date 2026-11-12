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
export function parseOwnerReturnDraft(body) {
  const { occurredAt, ...draft } = body || {};
  const time = new Date(occurredAt);
  if (typeof occurredAt !== 'string' || !Number.isFinite(+time) || time > new Date())
    throw httpError(400, 'Cần giờ giao xe thực tế hợp lệ.');
  return { ...parseIntakeDraft(draft), returned_at: time };
}

export function handoverType(value) {
  if (!['pickup', 'return'].includes(value)) throw httpError(400, 'Loại giao nhận phải là pickup hoặc return.');
  return value;
}
export function parseHandoverConfirmation(body) {
  if (!body || Object.keys(body).some((key) => !['version', 'renterConfirmed', 'disputeNote', 'occurredAt'].includes(key))
    || typeof body.renterConfirmed !== 'boolean') throw httpError(400, 'Cần ghi nhận phản hồi của khách thuê.');
  const note = body.disputeNote ?? '';
  if (typeof note !== 'string' || note.length > 1000 || (!body.renterConfirmed && !note.trim()))
    throw httpError(400, 'Cần ghi lý do chưa có xác nhận của khách.');
  const occurredAt = body.occurredAt === undefined ? undefined : new Date(body.occurredAt);
  if (occurredAt && (typeof body.occurredAt !== 'string' || !Number.isFinite(+occurredAt) || occurredAt > new Date()))
    throw httpError(400, 'Thời điểm giao nhận thực tế không hợp lệ.');
  return { version: parseVersion(body.version), renterConfirmed: body.renterConfirmed, note: note.trim(), occurredAt };
}
