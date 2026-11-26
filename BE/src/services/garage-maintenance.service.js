const { MaintenanceRecord, TripWorkflow, Vehicle, VehicleInspection } = require('../models');
const { lockVehicleSchedule, runInTransaction } = require('../repositories/booking.repository');
const HttpError = require('../utils/http-error');
const { positiveId, nextId, retryDuplicateId } = require('../utils/numeric-id');
const { VEHICLE_SUMMARY_FIELDS } = require('../config/management.constants');

const CLOSED_MAINTENANCE = ['completed', 'closed', 'cancelled'];

function text(value, label, required = true) {
  if (!required && value == null) return '';
  if (typeof value !== 'string' || value.trim().length > 1000 || (required && !value.trim())) {
    throw new HttpError(400, `${label} phải hợp lệ (tối đa 1000 ký tự)`);
  }
  return value.trim();
}

function openMaintenance(vehicleId) {
  return {
    ...(vehicleId != null && { vehicle_id: vehicleId }),
    maintenance_status: { $nin: CLOSED_MAINTENANCE },
  };
}

async function openForDamage({ vehicleId, staffId, description }, session) {
  const pending = await MaintenanceRecord.findOneAndUpdate(openMaintenance(vehicleId), {
    $set: {
      maintenance_status: 'in_progress',
      repair_completed_at: null,
      reinspection_id: null,
    },
  }, { session, sort: { maintenance_id: -1 } });
  if (pending) return pending.maintenance_id;

  const maintenance_id = await nextId(MaintenanceRecord, 'maintenance_id', session);
  await MaintenanceRecord.create([{
    maintenance_id, vehicle_id: vehicleId, reported_by: staffId, description,
    maintenance_status: 'in_progress', started_at: new Date(),
  }], { session });
  return maintenance_id;
}

async function withMaintenance(id, work, vehicleId) {
  const maintenance_id = positiveId(id, 'Mã phiếu bảo dưỡng');
  return runInTransaction(async (session) => {
    if (!session) throw new HttpError(503, 'Cần MongoDB replica set để cập nhật phiếu bảo dưỡng');
    const maintenance = await MaintenanceRecord.findOne({ maintenance_id }).session(session);
    if (!maintenance) throw new HttpError(404, 'Không tìm thấy phiếu bảo dưỡng');
    if (vehicleId != null && maintenance.vehicle_id !== vehicleId) {
      throw new HttpError(409, 'Xe không khớp với phiếu bảo dưỡng');
    }
    const vehicle = await lockVehicleSchedule(maintenance.vehicle_id, session);
    if (!vehicle) throw new HttpError(409, 'Không tìm thấy xe trong phiếu bảo dưỡng');
    return work(maintenance, vehicle, session);
  });
}

function assertEditable(maintenance) {
  if (CLOSED_MAINTENANCE.includes(maintenance.maintenance_status)) {
    throw new HttpError(409, 'Phiếu bảo dưỡng hiện không thể thay đổi');
  }
}

function findReinspection(maintenance, session = null) {
  if (!maintenance.reinspection_id) return null;
  return VehicleInspection.findOne({
    inspection_id: maintenance.reinspection_id, vehicle_id: maintenance.vehicle_id,
    maintenance_id: maintenance.maintenance_id, inspection_type: 'periodic',
  }).session(session).lean();
}

async function setVehicleInMaintenance(vehicle, session) {
  if (['available', 'maintenance'].includes(vehicle.status)) {
    await Vehicle.updateOne({ vehicle_id: vehicle.vehicle_id }, { $set: { status: 'maintenance' } }, { session });
  }
}

function vehicleStillInTrip(vehicle_id, session) {
  return TripWorkflow.exists({
    vehicle_id, vehicle_returned: { $ne: true }, stage: { $nin: ['completed', 'cancelled'] },
    $or: [
      { vehicle_received: true },
      { stage: { $in: ['awaiting_vehicle_return', 'vehicle_return_issue'] } },
    ],
  }).session(session);
}

async function assertVehicleReturned(vehicle_id, session) {
  if (await vehicleStillInTrip(vehicle_id, session)) {
    throw new HttpError(409, 'Cần xác nhận xe đã về Gara hoặc đổi xe cho chuyến đang sử dụng');
  }
}

async function recordRepair(id, input, staffId) {
  const repair_work = text(input.repair_work, 'Công việc đã thực hiện');
  const repair_result = text(input.repair_result, 'Kết quả sửa chữa');
  return withMaintenance(id, async (maintenance, vehicle, session) => {
    assertEditable(maintenance);
    maintenance.set({
      repair_work, repair_result, repair_recorded_by: staffId, repair_completed_at: new Date(),
      started_at: maintenance.started_at || new Date(), maintenance_status: 'in_progress',
      reinspection_id: null,
    });
    await setVehicleInMaintenance(vehicle, session);
    return maintenance.save({ session });
  });
}

async function recordReinspection(id, input) {
  return retryDuplicateId(['inspection_id'], () => withMaintenance(id, async (maintenance, vehicle, session) => {
    assertEditable(maintenance);
    if (!maintenance.repair_completed_at || maintenance.maintenance_status !== 'in_progress') {
      throw new HttpError(409, 'Cần ghi kết quả sửa chữa trước khi kiểm tra lại');
    }
    const inspection_id = await nextId(VehicleInspection, 'inspection_id', session);
    const [inspection] = await VehicleInspection.create([{
      ...input, inspection_id, maintenance_id: maintenance.maintenance_id, inspected_at: new Date(),
    }], { session });
    maintenance.reinspection_id = inspection_id;
    await maintenance.save({ session });
    await setVehicleInMaintenance(vehicle, session);
    return { inspection: inspection.toObject(), workflow: null };
  }, input.vehicle_id));
}

async function releaseVehicleIfReady({ vehicle_id, status }, session, expectedStatus = 'maintenance') {
  if (status !== expectedStatus || await MaintenanceRecord.exists(openMaintenance(vehicle_id)).session(session)
    || await vehicleStillInTrip(vehicle_id, session)) return;
  await Vehicle.updateOne({ vehicle_id }, { $set: { status: 'available' } }, { session });
}

async function complete(maintenance, vehicle, session) {
  maintenance.maintenance_status = 'completed';
  maintenance.completed_at = new Date();
  await maintenance.save({ session });
  await releaseVehicleIfReady(vehicle, session);
}

async function updateMaintenance(id, { status, inspection_id }, staffId) {
  if (!['in_progress', 'completed'].includes(status)) throw new HttpError(400, 'Trạng thái bảo dưỡng không hợp lệ');
  if (inspection_id !== undefined && (!Number.isSafeInteger(inspection_id) || inspection_id < 1)) {
    throw new HttpError(400, 'Mã kiểm tra lại không hợp lệ');
  }
  return withMaintenance(id, async (maintenance, vehicle, session) => {
    assertEditable(maintenance);
    if (status === 'in_progress') {
      maintenance.maintenance_status = status;
      maintenance.started_at ||= new Date();
      await setVehicleInMaintenance(vehicle, session);
      await maintenance.save({ session });
    } else {
      if (inspection_id !== undefined && maintenance.reinspection_id !== inspection_id) {
        throw new HttpError(409, 'Phiếu đã có lần kiểm tra mới. Vui lòng làm mới hồ sơ.');
      }
      if ((await findReinspection(maintenance, session))?.result !== 'passed') {
        throw new HttpError(409, 'Cần ghi nhận kiểm tra đạt sau sửa chữa trên phiếu này');
      }
      await assertVehicleReturned(vehicle.vehicle_id, session);
      await complete(maintenance, vehicle, session);
    }
    return { maintenance_id: maintenance.maintenance_id, status: maintenance.maintenance_status, updated_by: staffId };
  });
}

async function taskDetails(id, vehicleId) {
  const maintenance = await MaintenanceRecord.findOne({ maintenance_id: id, vehicle_id: vehicleId }).lean();
  if (!maintenance) return null;
  const [vehicle, damage_sources, reinspection] = await Promise.all([
    Vehicle.findOne({ vehicle_id: vehicleId }).select(VEHICLE_SUMMARY_FIELDS).lean(),
    VehicleInspection.find({
      vehicle_id: vehicleId, maintenance_id: id, inspection_type: 'return', result: { $in: ['fail', 'failed'] },
    }).select('booking_id inspection_id -_id').sort({ inspection_id: -1 }).lean(),
    findReinspection(maintenance),
  ]);
  const status = maintenance.maintenance_status === 'awaiting_approval' ? 'in_progress' : maintenance.maintenance_status;
  return {
    id: `maintenance-${id}`, vehicle_id: vehicleId, type: 'MAINTENANCE', vehicle, maintenance,
    status, archived: CLOSED_MAINTENANCE.includes(status), damage_sources, reinspection,
  };
}

module.exports = {
  openMaintenance, openForDamage, releaseVehicleIfReady, recordRepair, recordReinspection,
  taskDetails, updateMaintenance,
};
