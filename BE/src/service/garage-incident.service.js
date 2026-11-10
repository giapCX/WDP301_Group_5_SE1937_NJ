import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';
import { garageTransaction } from '../utils/garage-transaction.js';

export function createGarageIncidentService(repository) {
  return {
    async get(id, actor) {
      const record = await repository.incidents.findOne({ _id: id, reported_by_user_id: actor._id });
      if (!record) throw httpError(404, 'Không tìm thấy báo cáo sự cố của bạn.');
      return record;
    },
    async create(input, actor) {
      await repository.incidents.ensureIndexes();
      const { photoKeys, ...fields } = input;
      const fingerprint = createHash('sha256').update(JSON.stringify({ vehicle: String(fields.vehicle_id), booking: fields.booking_id ? String(fields.booking_id) : null, description: fields.description, severity: fields.severity, photoKeys })).digest('hex');
      const filter = { reported_by_user_id: actor._id, request_key: fields.request_key };
      const replay = (record) => {
        if (record.request_fingerprint !== fingerprint) throw httpError(409, 'Mã yêu cầu đã được dùng cho báo cáo khác.');
        return { data: record, replayed: true };
      };
      const existing = await repository.incidents.findOne(filter);
      if (existing) return replay(existing);
      try {
        return await garageTransaction(repository, async (session) => {
          const duplicate = await repository.incidents.findOne(filter, { session });
          if (duplicate) return replay(duplicate);
          if (!await repository.vehicles.findOne({ _id: fields.vehicle_id }, { session, projection: { _id: 1 } })) throw httpError(404, 'Không tìm thấy xe.');
          if (fields.booking_id && !await repository.bookings.findOne({ _id: fields.booking_id, vehicle_id: fields.vehicle_id }, { session, projection: { _id: 1 } })) throw httpError(409, 'Đơn thuê không thuộc xe đã chọn.');
          const id = new Types.ObjectId();
          const now = new Date();
          const record = await repository.incidents.create({ ...fields, _id: id, case_number: `SC-${id}`, request_fingerprint: fingerprint, reported_by_user_id: actor._id, case_type: 'vehicle_damage', status: 'reported', investigation: { review_status: 'pending' }, evidence: photoKeys.map((file_key) => ({ kind: 'image', file_key, uploaded_by_user_id: actor._id })), created_at: now, updated_at: now }, { session });
          await repository.auditLogs.create({ actor_user_id: actor._id, action: 'garage.incident.reported', entity_type: 'incident_case', entity_id: id, created_at: now, sanitized_changes: { vehicle_id: fields.vehicle_id } }, { session });
          return { data: record, replayed: false };
        });
      } catch (error) {
        if (error.code === 11000) {
          const duplicate = await repository.incidents.findOne(filter);
          if (duplicate) return replay(duplicate);
        }
        throw error;
      }
    },
  };
}
