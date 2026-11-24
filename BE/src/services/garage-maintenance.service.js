const { MaintenanceRecord, TripWorkflow, Vehicle, VehicleDamage, VehicleInspection } = require('../models');
const { lockVehicleSchedule, runInTransaction } = require('../repositories/booking.repository');
const HttpError = require('../utils/http-error');
const { positiveId, nextId, retryDuplicateId } = require('../utils/numeric-id');

const CLOSED_MAINTENANCE = ['completed', 'closed', 'cancelled'];
const AWAITING_APPROVAL = 'awaiting_approval';
const SAFETY_ITEMS = ['tires', 'lights', 'brakes', 'safety'];
const VEHICLE_FIELDS = 'vehicle_id plate_number brand model status -_id';

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

async function openForDamage({ vehicleId, staffId, description, requiresApproval = false }, session) {
  const pending = await MaintenanceRecord.findOneAndUpdate(openMaintenance(vehicleId), {
    $set: {
      maintenance_status: 'in_progress',
      repair_completed_at: null,
      reinspection_id: null,
      ...(requiresApproval && { requires_manager_approval: true }),
    },
  }, { session, sort: { maintenance_id: -1 } });
  if (pending) return pending.maintenance_id;

  const maintenance_id = await nextId(MaintenanceRecord, 'maintenance_id', session);
  await MaintenanceRecord.create([{
    maintenance_id, vehicle_id: vehicleId, reported_by: staffId, description,
    maintenance_status: 'in_progress', started_at: new Date(), requires_manager_approval: requiresApproval,
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
  if ([...CLOSED_MAINTENANCE, AWAITING_APPROVAL].includes(maintenance.maintenance_status)) {
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

async function requiresApproval(maintenance, session = null) {
  if (maintenance.requires_manager_approval) return true;
  const source = { maintenance_id: maintenance.maintenance_id, vehicle_id: maintenance.vehicle_id };
  const failedSafetyCheck = await VehicleInspection.exists({
    ...source,
    result: { $in: ['fail', 'failed'] },
    $or: SAFETY_ITEMS.map((item) => ({ [`checklist.${item}`]: 'failed' })),
  }).session(session);
  if (failedSafetyCheck) return true;
  return Boolean(await VehicleDamage.exists({ ...source, damaged_items: { $in: SAFETY_ITEMS } }).session(session));
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
      requires_manager_approval: maintenance.requires_manager_approval || input.affects_safety === true,
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
      if (await requiresApproval(maintenance, session)) {
        maintenance.requires_manager_approval = true;
        maintenance.maintenance_status = AWAITING_APPROVAL;
        await maintenance.save({ session });
      } else {
        await complete(maintenance, vehicle, session);
      }
    }
    return { maintenance_id: maintenance.maintenance_id, status: maintenance.maintenance_status, updated_by: staffId };
  });
}

async function decide(id, input, managerId) {
  const { decision, inspection_id } = input;
  if (!['approve', 'reject'].includes(decision)) throw new HttpError(400, 'Quyết định duyệt không hợp lệ');
  if (!Number.isSafeInteger(inspection_id) || inspection_id < 1) {
    throw new HttpError(400, 'Mã kiểm tra lại không hợp lệ');
  }
  const note = text(input.note, 'Lý do duyệt hoặc trả phiếu', decision === 'reject');
  return withMaintenance(id, async (maintenance, vehicle, session) => {
    if (maintenance.maintenance_status !== AWAITING_APPROVAL || maintenance.reinspection_id !== inspection_id) {
      throw new HttpError(409, 'Phiếu đã thay đổi. Vui lòng tải lại danh sách.');
    }
    if (decision === 'approve') {
      if ((await findReinspection(maintenance, session))?.result !== 'passed') {
        throw new HttpError(409, 'Phiếu chưa có kết quả kiểm tra đạt');
      }
      await assertVehicleReturned(vehicle.vehicle_id, session);
    }
    maintenance.approvals ||= [];
    maintenance.approvals.push({
      decision, note, manager_id: managerId, inspection_id, decided_at: new Date(),
    });
    if (decision === 'approve') {
      await complete(maintenance, vehicle, session);
    } else {
      maintenance.set({ maintenance_status: 'in_progress', repair_completed_at: null, reinspection_id: null });
      await maintenance.save({ session });
    }
    return { maintenance_id: maintenance.maintenance_id, status: maintenance.maintenance_status };
  });
}

async function listApprovals() {
  const records = await MaintenanceRecord.find({ maintenance_status: AWAITING_APPROVAL })
    .sort({ repair_completed_at: 1, maintenance_id: 1 }).populate('vehicle', VEHICLE_FIELDS).lean();
  const inspections = await VehicleInspection.find({
    inspection_id: { $in: records.map((record) => record.reinspection_id).filter(Number.isFinite) },
    inspection_type: 'periodic',
  }).select('inspection_id vehicle_id maintenance_id condition_note inspected_at odometer result -_id').lean();
  const inspectionsById = new Map(inspections.map((inspection) => [inspection.inspection_id, inspection]));
  return records.map((record) => {
    const inspection = inspectionsById.get(record.reinspection_id);
    const matchesRecord = inspection?.maintenance_id === record.maintenance_id && inspection?.vehicle_id === record.vehicle_id;
    return { ...record, reinspection: matchesRecord ? inspection : null };
  });
}

async function taskDetails(id, vehicleId) {
  const maintenance = await MaintenanceRecord.findOne({ maintenance_id: id, vehicle_id: vehicleId }).lean();
  if (!maintenance) return null;
  const [vehicle, damage_sources, reinspection, needs_approval] = await Promise.all([
    Vehicle.findOne({ vehicle_id: vehicleId }).select(VEHICLE_FIELDS).lean(),
    VehicleInspection.find({
      vehicle_id: vehicleId, maintenance_id: id, inspection_type: 'return', result: { $in: ['fail', 'failed'] },
    }).select('booking_id inspection_id -_id').sort({ inspection_id: -1 }).lean(),
    findReinspection(maintenance),
    requiresApproval(maintenance),
  ]);
  const status = maintenance.maintenance_status;
  return {
    id: `maintenance-${id}`, vehicle_id: vehicleId, type: 'MAINTENANCE', vehicle, maintenance,
    status, archived: CLOSED_MAINTENANCE.includes(status), damage_sources, reinspection, needs_approval,
  };
}

module.exports = {
  openMaintenance, openForDamage, releaseVehicleIfReady, recordRepair, recordReinspection,
  taskDetails, updateMaintenance, listApprovals, decide,
};
