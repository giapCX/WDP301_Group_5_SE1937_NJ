const { MaintenanceRecord, TripWorkflow, Vehicle, VehicleInspection } = require('../models');
const { lockVehicleSchedule, runInTransaction } = require('../repositories/booking.repository');
const { readInspectionDetails } = require('../utils/garage-inspection-details');
const HttpError = require('../utils/http-error');
const { positiveId, nextId, retryDuplicateId } = require('../utils/numeric-id');
const addTripHistory = require('../utils/trip-history');
const maintenance = require('./garage-maintenance.service');
const { findTripInspection } = require('./garage-task.service');

function inspectionNote(value, required = true) {
  const note = typeof value === 'string' ? value.trim() : value;
  if (note != null && (typeof note !== 'string' || note.length > 1000)) {
    throw new HttpError(400, 'Ghi chú kiểm tra phải là văn bản, tối đa 1000 ký tự');
  }
  if (required && !note) throw new HttpError(400, 'Ghi chú kiểm tra là bắt buộc');
  return note || null;
}

function assertOdometer(odometer) {
  if (!Number.isFinite(odometer) || odometer < 0) throw new HttpError(400, 'Số km không hợp lệ');
}

async function saveTripInspection(input, bookingId, vehicleId, staffId) {
  const { result, odometer, inspection_type: type } = input;
  const returning = type === 'return';
  const evidenceRequired = !returning || result !== 'passed';
  const conditionNote = inspectionNote(input.condition_note, evidenceRequired);
  const details = readInspectionDetails(input, evidenceRequired);
  assertOdometer(odometer);

  const field = type + '_inspection_id';
  return retryDuplicateId(['inspection_id', 'maintenance_id'], () => runInTransaction(async (session) => {
    if (!session) throw new HttpError(503, 'Cần MongoDB replica set để lưu hồ sơ và trạng thái xe cùng lúc');
    const vehicle = await lockVehicleSchedule(vehicleId, session);
    const workflow = await TripWorkflow.findOne({ booking_id: bookingId }).session(session);
    if (!vehicle || !workflow || workflow.vehicle_id !== vehicleId) {
      throw new HttpError(409, 'Xe không khớp với phân công hiện tại');
    }
    if (workflow[field] != null) throw new HttpError(409, 'Lần kiểm tra xe này đã được lưu');
    if (returning) {
      if (!['awaiting_vehicle_return', 'vehicle_return_issue'].includes(workflow.stage)
        || workflow.vehicle_returned || workflow.end_odometer == null) {
        throw new HttpError(409, 'Chuyến chưa có báo cáo để Gara tiếp nhận xe');
      }
    } else if (workflow.stage !== 'awaiting_vehicle' || workflow.driver_response !== 'accepted') {
      throw new HttpError(409, 'Chuyến chưa tới bước kiểm tra trước bàn giao');
    }

    const before = returning && await findTripInspection(
      bookingId, vehicleId, 'handover', workflow.handover_inspection_id, session,
    );
    if (returning && odometer < (before?.odometer ?? workflow.start_odometer ?? 0)) {
      throw new HttpError(400, 'Số km tiếp nhận không được thấp hơn lúc bàn giao');
    }
    if (!returning && result === 'passed') {
      const open = await MaintenanceRecord.exists(maintenance.openMaintenance(vehicleId)).session(session);
      if (open || !['available', 'in_use'].includes(vehicle.status)) {
        throw new HttpError(409, 'Xe đang bảo dưỡng hoặc không sẵn sàng để bàn giao');
      }
    }

    let maintenanceId;
    if (result === 'failed') {
      workflow.resume_stage ||= returning ? 'awaiting_vehicle_return' : 'to_pickup';
      workflow.stage = returning ? 'vehicle_return_issue' : 'vehicle_replacement_required';
      await Vehicle.updateOne({ vehicle_id: vehicleId }, { $set: { status: 'maintenance' } }, { session });
      const bookingCode = 'VT-' + String(bookingId).padStart(6, '0');
      maintenanceId = await maintenance.openForDamage({
        vehicleId, staffId,
        description: `Kiểm tra ${returning ? 'tiếp nhận' : 'bàn giao'} không đạt cho booking ${bookingCode}: ${conditionNote}`,
      }, session);
    }
    const inspectionId = await nextId(VehicleInspection, 'inspection_id', session);
    const [inspection] = await VehicleInspection.create([{
      inspection_id: inspectionId, booking_id: bookingId, vehicle_id: vehicleId, staff_id: staffId,
      inspection_type: type, condition_note: conditionNote, inspected_at: new Date(),
      ...(returning && { before_inspection_id: before?.inspection_id ?? null }),
      ...(maintenanceId != null && { maintenance_id: maintenanceId }),
      result, odometer, ...details,
    }], { session });
    workflow[field] = inspectionId;
    addTripHistory(workflow, `${type}_inspection_${result}`, staffId, conditionNote);
    await workflow.save({ session });

    const { photos, ...publicInspection } = inspection.toObject();
    return { inspection: publicInspection, workflow: workflow.toObject() };
  }));
}

async function inspectionPhoto(id, index) {
  const inspectionId = positiveId(id, 'inspection_id');
  const photoIndex = positiveId(index, 'Ảnh kiểm tra') - 1;
  const inspection = await VehicleInspection.findOne({ inspection_id: inspectionId }).select('+photos');
  const photo = inspection?.photos?.[photoIndex];
  if (!photo) throw new HttpError(404, 'Không tìm thấy ảnh kiểm tra');
  return photo;
}

async function recordInspection(input, staffId) {
  const type = input.inspection_type;
  if (!['handover', 'return', 'periodic'].includes(type)) throw new HttpError(400, 'Loại kiểm tra không hợp lệ');
  const vehicleId = positiveId(input.vehicle_id, 'vehicle_id');
  const bookingId = input.booking_id == null && type === 'periodic' ? null : positiveId(input.booking_id, 'booking_id');
  if (type !== 'periodic') return saveTripInspection(input, bookingId, vehicleId, staffId);

  const { result } = input;
  if (!['passed', 'failed'].includes(result)) throw new HttpError(400, 'Kết quả phải là đạt hoặc không đạt');
  const conditionNote = inspectionNote(input.condition_note);
  const odometer = typeof input.odometer === 'string' && input.odometer.trim() ? Number(input.odometer) : input.odometer;
  assertOdometer(odometer);
  const periodic = {
    booking_id: bookingId, vehicle_id: vehicleId, staff_id: staffId,
    inspection_type: type, condition_note: conditionNote, result, odometer,
  };
  if (input.maintenance_id != null) {
    if (bookingId != null) throw new HttpError(400, 'Kiểm tra sau sửa chữa chỉ gắn với phiếu bảo dưỡng');
    return maintenance.recordReinspection(input.maintenance_id, periodic);
  }
  return retryDuplicateId(['inspection_id'], () => runInTransaction(async (session) => {
    const vehicle = await lockVehicleSchedule(vehicleId, session);
    if (!vehicle) throw new HttpError(404, 'Không tìm thấy xe cần kiểm tra');
    const inspection_id = await nextId(VehicleInspection, 'inspection_id', session);
    const [inspection] = await VehicleInspection.create([{
      ...periodic, inspection_id, inspected_at: new Date(),
    }], { session });
    if (result === 'failed') {
      await Vehicle.updateOne({ vehicle_id: vehicleId }, { $set: { status: 'maintenance' } }, { session });
    } else {
      await maintenance.releaseVehicleIfReady(vehicle, session);
    }
    const workflow = bookingId == null ? null : await TripWorkflow.findOne({ booking_id: bookingId }).session(session);
    if (workflow) {
      addTripHistory(workflow, `periodic_inspection_${result}`, staffId, conditionNote);
      await workflow.save({ session });
    }
    return { inspection: inspection.toObject(), workflow: workflow?.toObject() || null };
  }));
}

module.exports = { recordInspection, inspectionPhoto };
