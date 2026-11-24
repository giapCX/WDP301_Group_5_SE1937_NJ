const {
  Booking, DriverProfile, MaintenanceRecord, TripWorkflow, Vehicle, VehicleInspection,
} = require('../models');
const HttpError = require('../utils/http-error');
const { readPreTripDetails } = require('../utils/garage-inspection-details');
const { lockVehicleSchedule, runInTransaction } = require('../repositories/booking.repository');

const CLOSED_MAINTENANCE = ['completed', 'closed', 'cancelled'];
const now = () => new Date();
function positive(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new HttpError(400, `${field} không hợp lệ`);
  return number;
}
function note(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 1000) throw new HttpError(400, 'Ghi chú kiểm tra là bắt buộc (tối đa 1000 ký tự)');
  return value.trim();
}
async function nextId(Model, field, session = null) {
  const [last] = await Model.find().session(session).sort({ [field]: -1 }).select(`${field} -_id`).limit(1).lean();
  return (last?.[field] || 0) + 1;
}
function pushHistory(workflow, action, actorId, detail) {
  workflow.history.push({ action, actor_id: actorId, note: detail, created_at: now() });
  workflow.updated_at = now();
}

async function tasks(query = {}) {
  const localDate = query.date || null;
  if (localDate && (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !Number.isFinite(new Date(`${localDate}T00:00:00+07:00`).getTime()))) throw new HttpError(400, 'Ngày lọc không hợp lệ');
  const startUtc = localDate ? new Date(`${localDate}T00:00:00+07:00`) : null;
  const endUtc = startUtc ? new Date(startUtc.getTime() + 86400000) : null;
  const workflows = await TripWorkflow.find({
    stage: { $in: ['awaiting_driver', 'awaiting_vehicle', 'vehicle_replacement_required', 'awaiting_vehicle_return', 'vehicle_return_issue'] },
  }).sort({ updated_at: -1 }).lean();
  const bookingIds = workflows.map((item) => item.booking_id);
  const inspections = await VehicleInspection.find({ booking_id: { $in: bookingIds } })
    .sort({ inspected_at: -1, inspection_id: -1 }).lean();
  const inspectionsById = new Map(inspections.map((inspection) => [inspection.inspection_id, inspection]));
  const existingByKey = new Map();
  for (const inspection of inspections) {
    const key = [inspection.booking_id, inspection.vehicle_id, inspection.inspection_type].join(':');
    if (!existingByKey.has(key)) existingByKey.set(key, inspection);
  }
  const tasks = [];
  for (const workflow of workflows) {
    const handoverKey = [workflow.booking_id, workflow.vehicle_id, 'handover'].join(':');
    const lastHandoverInspection = workflow.handover_inspection_id === undefined
      ? existingByKey.get(handoverKey)
      : inspectionsById.get(workflow.handover_inspection_id);
    const handoverInspection = workflow.stage !== 'awaiting_driver'
      && lastHandoverInspection?.vehicle_id === workflow.vehicle_id
      ? lastHandoverInspection : undefined;
    const blockedHandover = workflow.stage === 'vehicle_replacement_required'
      && ['failed', 'fail'].includes(handoverInspection?.result);
    if (['awaiting_driver', 'awaiting_vehicle'].includes(workflow.stage) || blockedHandover) {
      tasks.push({
        id: `handover-${workflow.booking_id}`, booking_id: workflow.booking_id, vehicle_id: workflow.vehicle_id,
        type: 'HANDOVER_OUT', inspection_type: 'handover',
        status: blockedHandover ? 'failed' : handoverInspection ? 'completed' : 'pending',
        inspection: handoverInspection,
      });
    }
    if (workflow.stage === 'awaiting_vehicle_return' || workflow.stage === 'vehicle_return_issue') {
      const key = [workflow.booking_id, workflow.vehicle_id, 'return'].join(':');
      const inspection = existingByKey.get(key);
      tasks.push({
        id: `return-${workflow.booking_id}`, booking_id: workflow.booking_id, vehicle_id: workflow.vehicle_id,
        type: 'RETURN_IN', inspection_type: 'return', status: !inspection ? 'pending' : ['passed', 'pass'].includes(inspection.result) ? 'completed' : 'in_progress', inspection,
      });
    }
  }
  const maintenance = await MaintenanceRecord.find({ maintenance_status: { $nin: CLOSED_MAINTENANCE } }).sort({ started_at: 1, maintenance_id: 1 }).lean();
  const allVehicleIds = [...new Set([...tasks.map((item) => item.vehicle_id), ...maintenance.map((item) => item.vehicle_id)])];
  const [vehicles, bookings, drivers] = await Promise.all([
    Vehicle.find({ vehicle_id: { $in: allVehicleIds } }).select('vehicle_id plate_number brand model status -_id').lean(),
    Booking.find({ booking_id: { $in: bookingIds } }).select('booking_id pickup_location dropoff_location pickup_time estimated_end_time -_id').lean(),
    DriverProfile.find({ driver_id: { $in: workflows.map((item) => item.driver_id) } }).populate({ path: 'user', select: 'full_name phone -_id' }).lean(),
  ]);
  const latestInspections = await VehicleInspection.find({ vehicle_id: { $in: maintenance.map((item) => item.vehicle_id) } }).sort({ inspected_at: -1, inspection_id: -1 }).lean();
  for (const item of maintenance) tasks.push({ id: `maintenance-${item.maintenance_id}`, vehicle_id: item.vehicle_id, type: 'MAINTENANCE', status: item.maintenance_status === 'in_progress' ? 'in_progress' : 'pending', maintenance: item, latest_inspection: latestInspections.find((inspection) => inspection.vehicle_id === item.vehicle_id) || null, due_at: item.started_at });
  return tasks.map((task) => {
    const workflow = workflows.find((item) => item.booking_id === task.booking_id);
    const booking = bookings.find((item) => item.booking_id === task.booking_id);
    const driverProfile = workflow && drivers.find((item) => item.driver_id === workflow.driver_id);
    const vehicle = vehicles.find((item) => item.vehicle_id === task.vehicle_id);
    return {
      ...task,
      vehicle,
      driver: driverProfile?.user || null,
      booking,
      due_at: task.inspection_type === 'handover' ? booking?.pickup_time : task.inspection_type === 'return' ? workflow?.ended_at : task.maintenance?.started_at,
      workflow_stage: workflow?.stage || null,
      latest_inspection: task.latest_inspection || null,
      note: task.inspection?.condition_note || task.maintenance?.description || null,
    };
  }).filter((item) => !startUtc || item.type === 'MAINTENANCE' || !item.due_at || (item.due_at >= startUtc && item.due_at < endUtc));
}

async function savePreTripInspection(input, bookingId, vehicleId, staffId) {
  const details = readPreTripDetails(input);
  const { result, odometer } = input;
  const conditionNote = note(input.condition_note);
  if (!Number.isFinite(odometer) || odometer < 0) {
    throw new HttpError(400, 'Số km không hợp lệ');
  }

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runInTransaction(async (session) => {
        if (!session) {
          throw new HttpError(503, 'Cần MongoDB replica set để lưu hồ sơ và trạng thái xe cùng lúc');
        }
        const vehicle = await lockVehicleSchedule(vehicleId, session);
        const workflow = await TripWorkflow.findOne({ booking_id: bookingId }).session(session);
        if (!vehicle || !workflow || workflow.vehicle_id !== vehicleId) {
          throw new HttpError(409, 'Xe không khớp với phân công hiện tại');
        }
        if (workflow.handover_inspection_id != null) {
          throw new HttpError(409, 'Lần kiểm tra xe này đã được lưu');
        }
        if (workflow.stage !== 'awaiting_vehicle' || workflow.driver_response !== 'accepted') {
          throw new HttpError(409, 'Chuyến chưa tới bước kiểm tra trước bàn giao');
        }

        const maintenance = await MaintenanceRecord.exists({
          vehicle_id: vehicleId, maintenance_status: { $nin: CLOSED_MAINTENANCE },
        }).session(session);
        if (result === 'passed' && (maintenance || !['available', 'in_use'].includes(vehicle.status))) {
          throw new HttpError(409, 'Xe đang bảo dưỡng hoặc không sẵn sàng để bàn giao');
        }

        const inspectionId = await nextId(VehicleInspection, 'inspection_id', session);
        const [inspection] = await VehicleInspection.create([{
          inspection_id: inspectionId, booking_id: bookingId, vehicle_id: vehicleId, staff_id: staffId,
          inspection_type: 'handover', condition_note: conditionNote, inspected_at: now(),
          result, odometer, ...details,
        }], { session });

        if (result === 'failed') {
          workflow.resume_stage ||= 'to_pickup';
          workflow.stage = 'vehicle_replacement_required';
          await Vehicle.updateOne({ vehicle_id: vehicleId }, { $set: { status: 'maintenance' } }, { session });
          if (!maintenance) {
            await MaintenanceRecord.create([{
              maintenance_id: await nextId(MaintenanceRecord, 'maintenance_id', session),
              vehicle_id: vehicleId, reported_by: staffId,
              description: `Không đạt kiểm tra bàn giao booking VT-${String(bookingId).padStart(6, '0')}: ${conditionNote}`,
              maintenance_status: 'in_progress', started_at: now(), completed_at: null,
            }], { session });
          }
        }
        workflow.handover_inspection_id = inspectionId;
        pushHistory(workflow, `handover_inspection_${result}`, staffId, conditionNote);
        await workflow.save({ session });

        const { photos, ...publicInspection } = inspection.toObject();
        return { inspection: publicInspection, workflow: workflow.toObject() };
      });
    } catch (error) {
      const duplicateInspectionId = error.keyPattern?.inspection_id && error.code === 11000;
      const duplicateMaintenanceId = error.keyPattern?.maintenance_id && error.code === 11000;
      if (attempt >= 2 || !(duplicateInspectionId || duplicateMaintenanceId)) throw error;
    }
  }
}

async function inspectionPhoto(id, index) {
  const inspectionId = positive(id, 'inspection_id');
  const photoIndex = positive(index, 'Ảnh kiểm tra') - 1;
  const inspection = await VehicleInspection.findOne({ inspection_id: inspectionId }).select('+photos');
  const photo = inspection?.photos?.[photoIndex];
  if (!photo) throw new HttpError(404, 'Không tìm thấy ảnh kiểm tra');
  return photo;
}

async function inspectAndHandover(input, staffId) {
  const inspectionType = input.inspection_type;
  const vehicleId = positive(input.vehicle_id, 'vehicle_id');
  if (!['handover', 'return', 'periodic'].includes(inspectionType)) throw new HttpError(400, 'Loại kiểm tra không hợp lệ');
  const bookingId = input.booking_id == null && inspectionType === 'periodic' ? null : positive(input.booking_id, 'booking_id');
  if (inspectionType === 'handover') return savePreTripInspection(input, bookingId, vehicleId, staffId);
  const workflow = bookingId == null ? null : await TripWorkflow.findOne({ booking_id: bookingId });
  if (inspectionType === 'return') {
    if (!workflow || !['awaiting_vehicle_return', 'vehicle_return_issue'].includes(workflow.stage)) throw new HttpError(409, 'Chuyến chưa tới bước trả xe');
    if (workflow.vehicle_id !== vehicleId) throw new HttpError(409, 'Xe không khớp với phân công hiện tại');
  }
  const result = input.result;
  if (!['passed', 'failed'].includes(result)) throw new HttpError(400, 'Kết quả phải là đạt hoặc không đạt');
  const conditionNote = note(input.condition_note);
  const odometer = Number(input.odometer);
  if (!Number.isFinite(odometer) || odometer < 0 || (inspectionType === 'return' && workflow.start_odometer != null && odometer < workflow.start_odometer)) throw new HttpError(400, 'Số km không hợp lệ');
  const inspectionId = await nextId(VehicleInspection, 'inspection_id');
  const inspection = await VehicleInspection.create({
    inspection_id: inspectionId, booking_id: bookingId, vehicle_id: vehicleId, staff_id: staffId,
    inspection_type: inspectionType, condition_note: conditionNote, result, inspected_at: now(), odometer,
  });
  if (inspectionType === 'return' && result === 'failed') {
    workflow.resume_stage = 'awaiting_vehicle_return';
    workflow.stage = 'vehicle_return_issue';
    await Vehicle.updateOne({ vehicle_id: vehicleId }, { $set: { status: 'maintenance' } });
    const open = await MaintenanceRecord.exists({ vehicle_id: vehicleId, maintenance_status: { $nin: CLOSED_MAINTENANCE } });
    if (!open) await MaintenanceRecord.create({ maintenance_id: await nextId(MaintenanceRecord, 'maintenance_id'), vehicle_id: vehicleId, reported_by: staffId, description: `Phát hiện hư hỏng khi nhận xe booking VT-${String(bookingId).padStart(6, '0')}: ${conditionNote}`, maintenance_status: 'in_progress', started_at: now(), completed_at: null });
  } else if (inspectionType === 'return') {
    workflow.stage = 'awaiting_vehicle_return';
    const openMaintenance = await MaintenanceRecord.exists({ vehicle_id: vehicleId, maintenance_status: { $nin: CLOSED_MAINTENANCE } });
    if (!openMaintenance) await Vehicle.updateOne({ vehicle_id: vehicleId }, { $set: { status: 'available' } });
  } else if (result === 'passed') {
    const openMaintenance = await MaintenanceRecord.exists({ vehicle_id: vehicleId, maintenance_status: { $nin: CLOSED_MAINTENANCE } });
    if (!openMaintenance) await Vehicle.updateOne({ vehicle_id: vehicleId }, { $set: { status: 'available' } });
  } else {
    await Vehicle.updateOne({ vehicle_id: vehicleId }, { $set: { status: 'maintenance' } });
  }
  if (workflow) { pushHistory(workflow, `${inspectionType}_inspection_${result}`, staffId, conditionNote); await workflow.save(); }
  return { inspection: inspection.toObject(), workflow: workflow?.toObject() || null };
}

async function updateMaintenance(id, input, staffId) {
  const maintenanceId = positive(id, 'maintenance_id');
  const maintenance = await MaintenanceRecord.findOne({ maintenance_id: maintenanceId });
  if (!maintenance) throw new HttpError(404, 'Không tìm thấy phiếu bảo dưỡng');
  const status = input.status;
  if (!['in_progress', 'completed'].includes(status)) throw new HttpError(400, 'Trạng thái bảo dưỡng không hợp lệ');
  maintenance.maintenance_status = status;
  if (!maintenance.started_at) maintenance.started_at = now();
  maintenance.completed_at = status === 'completed' ? now() : null;
  if (status === 'completed') {
    const lastInspection = await VehicleInspection.findOne({ vehicle_id: maintenance.vehicle_id }).sort({ inspected_at: -1 }).lean();
    const passed = lastInspection && ['passed', 'pass'].includes(lastInspection.result) && new Date(lastInspection.inspected_at) >= new Date(maintenance.started_at || 0);
    if (!passed) throw new HttpError(409, 'Cần ghi nhận kiểm tra đạt sau bảo dưỡng trước khi xe hoạt động');
    await Vehicle.updateOne({ vehicle_id: maintenance.vehicle_id }, { $set: { status: 'available' } });
  } else {
    await Vehicle.updateOne({ vehicle_id: maintenance.vehicle_id }, { $set: { status: 'maintenance' } });
  }
  await maintenance.save();
  return { maintenance_id: maintenanceId, status: maintenance.maintenance_status, updated_by: staffId };
}

module.exports = { tasks, inspectAndHandover, inspectionPhoto, updateMaintenance };
