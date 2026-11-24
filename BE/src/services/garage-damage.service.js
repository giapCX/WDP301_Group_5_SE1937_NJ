const { Incident, VehicleDamage, VehicleInspection } = require('../models');
const { runInTransaction } = require('../repositories/booking.repository');
const { CHECKLIST_ITEMS, readInspectionPhotos } = require('../utils/garage-inspection-details');
const HttpError = require('../utils/http-error');

function reportId(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new HttpError(400, 'Mã hồ sơ không hợp lệ');
  return number;
}

async function create(input, staffId) {
  const inspectionId = reportId(input.inspection_id);
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const { damaged_items: items, evidence_source: source, share_with_operator: share = false } = input;
  if (!description || description.length > 1000) throw new HttpError(400, 'Cần mô tả hư hỏng từ 1 đến 1000 ký tự');
  if (!Array.isArray(items) || !items.length || items.length > CHECKLIST_ITEMS.length
    || items.some((item) => !CHECKLIST_ITEMS.includes(item)) || new Set(items).size !== items.length) {
    throw new HttpError(400, 'Chọn ít nhất một hạng mục hư hỏng hợp lệ');
  }
  if (!['inspection', 'upload'].includes(source) || typeof share !== 'boolean') {
    throw new HttpError(400, 'Nguồn ảnh hoặc tùy chọn chuyển xử lý không hợp lệ');
  }
  const images = source === 'upload' ? readInspectionPhotos(input.photos) : undefined;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runInTransaction(async (session) => {
        if (!session) throw new HttpError(503, 'Cần MongoDB replica set để lưu báo cáo hư hỏng');
        const inspection = await VehicleInspection.findOne({ inspection_id: inspectionId }).session(session).lean();
        if (!inspection) throw new HttpError(404, 'Không tìm thấy hồ sơ kiểm tra xe');
        if (inspection.inspection_type !== 'return' || !['fail', 'failed'].includes(inspection.result)
          || !Number.isSafeInteger(inspection.booking_id)) {
          throw new HttpError(409, 'Chỉ lập báo cáo từ hồ sơ tiếp nhận xe không đạt');
        }
        const count = images?.length ?? inspection.photo_count;
        if (!Number.isInteger(count) || count < 1 || count > 3) {
          throw new HttpError(400, 'Hồ sơ tiếp nhận thiếu ảnh bằng chứng. Hãy tải ảnh lên.');
        }
        if (await VehicleDamage.exists({ inspection_id: inspectionId }).session(session)) {
          throw new HttpError(409, 'Hồ sơ này đã có báo cáo hư hỏng');
        }

        let incidentId = null;
        if (share) {
          const last = await Incident.findOne().sort({ incident_id: -1 }).select('incident_id').session(session).lean();
          incidentId = (last?.incident_id || 0) + 1;
          await Incident.create([{
            incident_id: incidentId, booking_id: inspection.booking_id, reported_by: staffId,
            garage_damage_inspection_id: inspectionId, description, incident_status: 'open',
          }], { session });
        }
        const [record] = await VehicleDamage.create([{
          inspection_id: inspectionId, booking_id: inspection.booking_id, vehicle_id: inspection.vehicle_id,
          reported_by: staffId, reported_at: new Date(), damaged_items: items, description,
          evidence_source: source, photo_count: count, photos: images,
          maintenance_id: inspection.maintenance_id ?? null, incident_id: incidentId,
        }], { session });
        const { photos, ...report } = record.toObject();
        return report;
      });
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.inspection_id) {
        throw new HttpError(409, 'Hồ sơ này đã có báo cáo hư hỏng');
      }
      if (attempt >= 2 || error.code !== 11000 || !error.keyPattern?.incident_id) throw error;
    }
  }
}

async function findForInspection(inspectionId) {
  const report = await VehicleDamage.findOne({ inspection_id: inspectionId }).lean();
  if (!report?.incident_id) return report;
  const incident = await Incident.findOne({
    incident_id: report.incident_id, garage_damage_inspection_id: inspectionId,
  }).select('incident_status resolution_note -_id').lean();
  return { ...report, incident };
}

async function evidencePhoto(inspectionId, index) {
  const report = await VehicleDamage.findOne({ inspection_id: reportId(inspectionId) }).select('+photos');
  const photoIndex = reportId(index) - 1;
  if (!report || photoIndex >= report.photo_count) throw new HttpError(404, 'Không tìm thấy ảnh bằng chứng');
  const inspection = report.evidence_source === 'inspection' && await VehicleInspection.findOne({
    inspection_id: report.inspection_id, booking_id: report.booking_id, vehicle_id: report.vehicle_id,
  }).select('+photos');
  const photo = (report.evidence_source === 'inspection' ? inspection?.photos : report.photos)?.[photoIndex];
  if (!photo) throw new HttpError(404, 'Không tìm thấy ảnh bằng chứng');
  return photo;
}

async function operatorPhoto(bookingId, incidentId, index) {
  const incident = await Incident.findOne({
    booking_id: reportId(bookingId), incident_id: reportId(incidentId),
  }).select('garage_damage_inspection_id').lean();
  if (!incident?.garage_damage_inspection_id) throw new HttpError(404, 'Không tìm thấy báo cáo Gara');
  return evidencePhoto(incident.garage_damage_inspection_id, index);
}

module.exports = { create, findForInspection, evidencePhoto, operatorPhoto };
