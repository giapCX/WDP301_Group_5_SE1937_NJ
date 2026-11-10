import { Types } from 'mongoose';
import { parseIntakeDraft } from './garage-intake.validator.js';
import { httpError, objectId } from '../utils/http-error.js';

export function parseGarageIncident(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['vehicleId', 'bookingId', 'description', 'severity', 'photoKeys', 'requestId'].includes(key))) throw httpError(400, 'Báo cáo sự cố không hợp lệ.');
  if (typeof body.description !== 'string' || body.description.trim().length < 10 || body.description.length > 1500) throw httpError(400, 'Mô tả sự cố cần từ 10 đến 1500 ký tự.');
  if (!['low', 'medium', 'high'].includes(body.severity)) throw httpError(400, 'Mức độ sự cố không hợp lệ.');
  if (typeof body.requestId !== 'string' || !/^[a-z\d-]{16,80}$/i.test(body.requestId)) throw httpError(400, 'Thiếu mã yêu cầu hợp lệ.');
  const photoKeys = parseIntakeDraft({ version: 0, condition: { photoKeys: body.photoKeys || [] } }).condition_snapshot.photo_keys;
  return {
    vehicle_id: new Types.ObjectId(objectId(body.vehicleId, 'vehicleId')),
    ...(body.bookingId ? { booking_id: new Types.ObjectId(objectId(body.bookingId, 'bookingId')) } : {}),
    description: body.description.trim(), severity: body.severity, photoKeys, request_key: body.requestId,
  };
}
