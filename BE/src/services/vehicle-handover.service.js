const {
  Booking, DriverProfile, MaintenanceRecord, TripAssignment, TripWorkflow,
  Vehicle, VehicleHandover, VehicleInspection,
} = require('../models');
const { lockVehicleSchedule, runInTransaction } = require('../repositories/booking.repository');
const HttpError = require('../utils/http-error');
const { positiveId: id } = require('../utils/numeric-id');
const addTripHistory = require('../utils/trip-history');
const { openMaintenance } = require('./garage-maintenance.service');

const ACTIVE_ASSIGNMENTS = ['assigned', 'accepted', 'in_progress'];
const DAY_MS = 24 * 60 * 60 * 1000;

function transact(work) {
  return runInTransaction((session) => {
    if (!session) throw new HttpError(503, 'Cần MongoDB replica set để lưu biên bản bàn giao');
    return work(session);
  });
}

function assertAwaitingHandover(workflow) {
  if (workflow?.stage !== 'awaiting_vehicle' || workflow.driver_response !== 'accepted') {
    throw new HttpError(409, 'Chuyến chưa tới bước bàn giao xe');
  }
}

function assertReceiveWindow(booking, workflow, receivedAt) {
  if (booking?.booking_status === 'in_progress' && workflow.started_at && workflow.resume_stage) return;
  const pickup = new Date(booking?.pickup_time).getTime();
  if (!booking?.pickup_time || !Number.isFinite(pickup)) {
    throw new HttpError(409, 'Booking chưa có giờ khởi hành hợp lệ');
  }
  if (+receivedAt < pickup - DAY_MS) {
    throw new HttpError(409, 'Chỉ có thể nhận xe trong 24 giờ trước giờ khởi hành');
  }
  if (+receivedAt >= pickup) throw new HttpError(409, 'Đã đến hoặc quá giờ khởi hành; vui lòng liên hệ Operator');
}

async function create(input, staffId) {
  const bookingId = id(input.booking_id);
  const vehicleId = id(input.vehicle_id);
  const inspectionId = id(input.inspection_id);
  return transact(async (session) => {
    const workflow = await TripWorkflow.findOne({ booking_id: bookingId }).session(session);
    assertAwaitingHandover(workflow);
    if (workflow.vehicle_id !== vehicleId || workflow.handover_inspection_id === null) {
      throw new HttpError(409, 'Cần kiểm tra xe đang được phân công trước khi lập biên bản');
    }
    const inspection = await VehicleInspection.findOne({
      booking_id: bookingId, vehicle_id: vehicleId, inspection_type: 'handover',
    }).sort({ inspected_at: -1, inspection_id: -1 }).session(session).lean();
    if (inspection?.inspection_id !== inspectionId
      || (workflow.handover_inspection_id ?? inspectionId) !== inspectionId
      || !['passed', 'pass'].includes(inspection.result)
      || !Number.isFinite(inspection.odometer)) {
      throw new HttpError(409, 'Cần hồ sơ kiểm tra đạt và số km của xe hiện tại');
    }
    const existing = await VehicleHandover.findOne({ inspection_id: inspectionId }).session(session);
    if (existing) return existing.toObject();

    workflow.handover_inspection_id = inspectionId;
    addTripHistory(workflow, 'handover_prepared', staffId);
    await workflow.save({ session });
    const [handover] = await VehicleHandover.create([{
      inspection_id: inspectionId, booking_id: bookingId, vehicle_id: vehicleId,
      driver_id: workflow.driver_id, prepared_by: staffId, prepared_at: new Date(),
    }], { session });
    return handover.toObject();
  });
}

async function recheck(inspectionId, staffId) {
  return transact(async (session) => {
    const handover = await VehicleHandover.findOne({ inspection_id: id(inspectionId) }).session(session);
    if (!handover) throw new HttpError(404, 'Không tìm thấy biên bản bàn giao');
    const workflow = await TripWorkflow.findOne({ booking_id: handover.booking_id }).session(session);
    assertAwaitingHandover(workflow);
    if (handover.status !== 'declined' || workflow.handover_inspection_id !== handover.inspection_id) {
      throw new HttpError(409, 'Chỉ kiểm tra lại biên bản hiện tại đã bị từ chối');
    }
    workflow.handover_inspection_id = null;
    addTripHistory(workflow, 'handover_recheck', staffId, handover.refusal_reason);
    await workflow.save({ session });
    return { booking_id: handover.booking_id };
  });
}

async function respond(bookingId, driverId, actorId, action, input) {
  const inspectionId = input.inspection_id == null ? null : id(input.inspection_id);
  const received = action === 'vehicle_received';
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!received && (!reason || reason.length > 500)) {
    throw new HttpError(400, 'Cần lý do từ chối từ 1 đến 500 ký tự');
  }
  return transact(async (session) => {
    const workflow = await TripWorkflow.findOne({ booking_id: bookingId, driver_id: driverId }).session(session);
    if (!workflow) throw new HttpError(404, 'Không tìm thấy chuyến được giao cho bạn');
    assertAwaitingHandover(workflow);
    if (inspectionId === null || workflow.handover_inspection_id !== inspectionId) {
      throw new HttpError(409, 'Cần biên bản bàn giao hiện tại đang chờ xác nhận');
    }
    const currentHandover = await VehicleHandover.findOne({
      inspection_id: inspectionId, booking_id: bookingId, vehicle_id: workflow.vehicle_id, driver_id: driverId,
    }).session(session);
    if (currentHandover?.status !== 'pending') {
      throw new HttpError(409, 'Cần biên bản bàn giao hiện tại đang chờ xác nhận');
    }
    const latest = await TripAssignment.findOne({ booking_id: bookingId })
      .sort({ assigned_at: -1, assignment_id: -1 }).session(session).lean();
    if (latest?.driver_id !== driverId || !ACTIVE_ASSIGNMENTS.includes(latest.assignment_status)) {
      throw new HttpError(409, 'Phân công không còn hiệu lực');
    }

    const respondedAt = new Date();
    if (received) {
      const booking = await Booking.findOne({ booking_id: bookingId }).session(session).lean();
      assertReceiveWindow(booking, workflow, respondedAt);
      const inspection = await VehicleInspection.findOne({
        inspection_id: inspectionId, booking_id: bookingId, vehicle_id: workflow.vehicle_id,
        inspection_type: 'handover', result: { $in: ['passed', 'pass'] },
      }).session(session).lean();
      if (!Number.isFinite(inspection?.odometer)) throw new HttpError(409, 'Biên bản thiếu số km kiểm tra xe');
      const vehicle = await lockVehicleSchedule(workflow.vehicle_id, session);
      const maintenance = await MaintenanceRecord.exists(openMaintenance(workflow.vehicle_id)).session(session);
      if (!vehicle || !['available', 'in_use'].includes(vehicle.status) || maintenance) {
        throw new HttpError(409, 'Xe đang bảo dưỡng hoặc không sẵn sàng để nhận');
      }
      workflow.vehicle_received = true;
      workflow.vehicle_received_at = respondedAt;
      workflow.start_odometer = inspection.odometer;
      workflow.stage = workflow.resume_stage || 'to_pickup';
      workflow.resume_stage = null;
      await Vehicle.updateOne({ vehicle_id: workflow.vehicle_id }, { $set: { status: 'in_use' } }, { session });
    }
    currentHandover.status = received ? 'accepted' : 'declined';
    currentHandover.responded_by = actorId;
    currentHandover.responded_at = respondedAt;
    currentHandover.refusal_reason = received ? null : reason;
    addTripHistory(workflow, action, actorId, currentHandover.refusal_reason);
    await currentHandover.save({ session });
    await workflow.save({ session });
    return workflow.toObject();
  });
}

async function assertDriverPhoto(bookingId, inspectionId, userId) {
  const profile = await DriverProfile.findOne({ user_id: userId }).lean();
  const handover = profile && await VehicleHandover.exists({
    inspection_id: id(inspectionId), booking_id: id(bookingId), driver_id: profile.driver_id,
  });
  if (!handover) throw new HttpError(404, 'Không tìm thấy biên bản của chuyến được giao');
}

async function driverRecords(inspectionIds, driverId) {
  const handovers = await VehicleHandover.find({
    inspection_id: { $in: inspectionIds.filter(Number.isFinite) }, driver_id: driverId,
  }).lean();
  const inspections = await VehicleInspection.find({
    inspection_id: { $in: handovers.map((handover) => handover.inspection_id) },
  }).lean();
  const byId = new Map(inspections.map((inspection) => [inspection.inspection_id, inspection]));
  return new Map(handovers.map((handover) => [
    handover.inspection_id, { ...handover, inspection: byId.get(handover.inspection_id) },
  ]));
}

module.exports = { create, recheck, respond, assertDriverPhoto, driverRecords };
