const mongoose = require('mongoose');
const {
  Booking, DriverProfile, Incident, MaintenanceRecord, TripAssignment,
  TripStatusUpdate, TripStop, TripWorkflow, User, Vehicle, VehicleDamage, VehicleInspection,
} = require('../models');
const HttpError = require('../utils/http-error');
const { requestedSeats } = require('./booking.service');
const { lockVehicleSchedule, runInTransaction } = require('../repositories/booking.repository');
const { positiveId: positive, nextId, retryDuplicateId } = require('../utils/numeric-id');
const addTripHistory = require('../utils/trip-history');
const handovers = require('./vehicle-handover.service');
const { openMaintenance, openForDamage, releaseVehicleIfReady } = require('./garage-maintenance.service');

const ACTIVE_ASSIGNMENTS = ['assigned', 'accepted', 'in_progress'];
const RESERVED_VEHICLE_STATUSES = ['awaiting_payment', 'confirmed', 'in_progress'];
const VEHICLE_INSPECTION_RESULTS = ['pass', 'passed', 'fail', 'failed'];
const now = () => new Date();
function text(value, field, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new HttpError(400, `${field} là bắt buộc (tối đa ${max} ký tự)`);
  return value.trim();
}
function date(value, field) {
  const result = new Date(value);
  if (!value || !Number.isFinite(result.getTime())) throw new HttpError(400, `${field} không hợp lệ`);
  return result;
}
async function syncDriverAvailability(driverId, session = null) {
  const activeAssignment = await TripAssignment.exists({
    driver_id: driverId, assignment_status: { $in: ACTIVE_ASSIGNMENTS },
  }).session(session);
  await DriverProfile.updateOne(
    { driver_id: driverId, availability_status: { $ne: 'unavailable' } },
    { $set: { availability_status: activeAssignment ? 'busy' : 'available' } },
    { session },
  );
}
function windowsOverlap(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}
async function assignmentsForBooking(bookingId, session = null) {
  return TripAssignment.find({ booking_id: bookingId }).sort({ assigned_at: -1, assignment_id: -1 }).session(session).lean();
}
function dispatchSeatCount(booking) {
  return booking.requested_seats ?? booking.requested_seat_count ?? booking.vehicle?.seat_count;
}
async function assertTripVehicleSeats(booking, vehicle, session = null) {
  const previousVehicle = dispatchSeatCount(booking) == null && booking.vehicle_id != null
    ? await Vehicle.findOne({ vehicle_id: booking.vehicle_id }).select('seat_count').session(session).lean() : null;
  const seats = requestedSeats({ ...booking, requested_seat_count: dispatchSeatCount(booking) ?? previousVehicle?.seat_count });
  if (vehicle.seat_count < seats) throw new HttpError(409, `Khách yêu cầu xe từ ${seats} chỗ.`);
  return seats;
}
function vehicleCanDispatch(vehicle) {
  return ['available', 'in_use'].includes(vehicle.status) && !['pending', 'rejected'].includes(vehicle.approval_status);
}
async function latestInspectionFailed(vehicle_id, session) {
  const inspection = await VehicleInspection.findOne({
    vehicle_id, result: { $in: VEHICLE_INSPECTION_RESULTS },
  }).sort({ inspected_at: -1, inspection_id: -1 }).select('result').session(session).lean();
  return ['fail', 'failed'].includes(inspection?.result);
}
async function availability({ booking, driverId, vehicleId, excludeBookingId }, session = null) {
  // Kiem tra dieu kien tai xe, xe, bao duong va lich trung truoc khi dieu phoi.
  const start = new Date(booking.pickup_time);
  const end = new Date(booking.estimated_end_time);
  const driver = await DriverProfile.findOne({ driver_id: driverId }).session(session).lean();
  if (!driver) throw new HttpError(404, 'Không tìm thấy hồ sơ tài xế');
  const existingWorkflow = excludeBookingId ? await TripWorkflow.findOne({ booking_id: excludeBookingId, driver_id: driverId }).session(session).lean() : null;
  const sameBookingReassignment = existingWorkflow && ['awaiting_driver', 'reassignment_required', 'vehicle_replacement_required', 'incident_open'].includes(existingWorkflow.stage);
  if (driver.availability_status === 'unavailable' || (!['available', 'busy'].includes(driver.availability_status) && !sameBookingReassignment)) throw new HttpError(409, 'Tài xế hiện không ở trạng thái sẵn sàng');
  if (!driver.approved_at) throw new HttpError(409, 'Hồ sơ tài xế chưa được duyệt');
  if (!driver.license_expiry || new Date(driver.license_expiry) < end) throw new HttpError(409, 'Giấy phép tài xế hết hạn trước khi chuyến kết thúc');
  const user = await User.findOne({ user_id: driver.user_id, status: 'active' }).select('user_id full_name phone status -_id').session(session).lean();
  if (!user) throw new HttpError(409, 'Tài khoản tài xế không hoạt động');
  const vehicle = await Vehicle.findOne({ vehicle_id: vehicleId }).session(session).lean();
  if (!vehicle) throw new HttpError(404, 'Không tìm thấy xe');
  const seats = await assertTripVehicleSeats(booking, vehicle, session);
  if (!vehicleCanDispatch(vehicle)) throw new HttpError(409, 'Xe đang bảo dưỡng hoặc không sẵn sàng');
  const maintenance = await MaintenanceRecord.exists(openMaintenance(vehicleId)).session(session);
  if (maintenance) throw new HttpError(409, 'Xe đang có phiếu bảo dưỡng chưa hoàn tất');
  if (await latestInspectionFailed(vehicleId, session)) {
    throw new HttpError(409, 'Xe có biên bản kiểm tra không đạt, cần gara xác nhận đạt trước khi phân công');
  }
  const leave = await mongoose.connection.collection('driver_unavailability').findOne({
    driver_id: driverId,
    status: { $nin: ['cancelled', 'rejected'] },
    start_at: { $lt: end }, end_at: { $gt: start },
  }, { session });
  if (leave) throw new HttpError(409, 'Tài xế có lịch nghỉ trùng thời gian chuyến');
  const overlapping = await TripAssignment.find({
    driver_id: driverId, booking_id: { $ne: excludeBookingId }, assignment_status: { $in: ACTIVE_ASSIGNMENTS },
  }).populate({ path: 'booking', select: 'pickup_time estimated_end_time -_id' }).session(session).lean();
  if (overlapping.some((item) => item.booking && windowsOverlap(start, end, item.booking.pickup_time, item.booking.estimated_end_time)))
    throw new HttpError(409, 'Tài xế đã được phân công một chuyến trùng lịch');
  const vehicleBookings = await Booking.find({ vehicle_id: vehicleId, booking_status: { $in: RESERVED_VEHICLE_STATUSES }, booking_id: { $ne: excludeBookingId } }).select('booking_id pickup_time estimated_end_time -_id').session(session).lean();
  if (vehicleBookings.some((item) => windowsOverlap(start, end, item.pickup_time, item.estimated_end_time)))
    throw new HttpError(409, 'Xe đã có booking trùng thời gian');
  return { driver, user, vehicle, seats };
}
async function dispatchData() {
  // Lay booking da xac nhan, tai xe, xe va su co de hien thi man dieu phoi Operator.
  const allWorkflows = await TripWorkflow.find().lean();
  const activeIds = allWorkflows.filter((workflow) => workflow.stage !== 'completed').map((workflow) => workflow.booking_id);
  const bookings = await Booking.find({ booking_status: { $in: ['confirmed', 'in_progress'] } })
    .where({ $or: [{ booking_status: 'confirmed' }, { booking_id: { $in: activeIds } }] })
    .sort({ pickup_time: 1 }).populate({ path: 'renter', select: 'full_name phone -_id' })
    .populate({ path: 'vehicle', select: 'vehicle_id plate_number brand model seat_count status -_id' }).lean();
  const [drivers, vehicles, reservations, maintenanceIds, inspections] = await Promise.all([
    DriverProfile.find().populate({ path: 'user', select: 'full_name phone status -_id' }).lean(),
    Vehicle.find().select('vehicle_id plate_number brand model seat_count status approval_status -_id').lean(),
    Booking.find({ vehicle_id: { $ne: null }, booking_status: { $in: RESERVED_VEHICLE_STATUSES } })
      .select('booking_id vehicle_id pickup_time estimated_end_time -_id').lean(),
    MaintenanceRecord.distinct('vehicle_id', openMaintenance()),
    VehicleInspection.aggregate([
      { $match: { result: { $in: VEHICLE_INSPECTION_RESULTS } } },
      { $sort: { inspected_at: -1, inspection_id: -1 } },
      { $group: { _id: '$vehicle_id', result: { $first: '$result' } } },
      { $match: { result: { $in: ['fail', 'failed'] } } },
    ]),
  ]);
  const blockedVehicles = new Set([...maintenanceIds, ...inspections.map(({ _id }) => _id)]);
  const readyVehicles = vehicles.filter((vehicle) => vehicleCanDispatch(vehicle) && !blockedVehicles.has(vehicle.vehicle_id));
  const workflows = new Map(allWorkflows.map((workflow) => [workflow.booking_id, workflow]));
  const incidents = await Incident.find({ incident_status: 'open' }).sort({ incident_id: -1 }).lean();
  const incidentWorkflows = await TripWorkflow.find({ booking_id: { $in: incidents.map((incident) => incident.booking_id) } }).select('booking_id stage -_id').lean();
  const reports = await VehicleDamage.find({
    inspection_id: { $in: incidents.map((incident) => incident.garage_damage_inspection_id).filter(Number.isFinite) },
  }).select('inspection_id photo_count damaged_items -_id').lean();
  const reportsById = new Map(reports.map((report) => [report.inspection_id, report]));
  const assigned = await TripAssignment.find({ booking_id: { $in: bookings.map((b) => b.booking_id) } }).sort({ assigned_at: -1, assignment_id: -1 }).lean();
  const latest = new Map();
  for (const item of assigned) if (!latest.has(item.booking_id)) latest.set(item.booking_id, item);
  return {
    bookings: bookings.map((booking) => {
      const workflow = workflows.get(booking.booking_id) || null;
      const start = workflow?.stage === 'vehicle_replacement_required' ? now() : booking.pickup_time;
      const seats = dispatchSeatCount(booking);
      const busyVehicles = new Set(reservations.filter((reservation) => reservation.booking_id !== booking.booking_id &&
        windowsOverlap(start, booking.estimated_end_time, reservation.pickup_time, reservation.estimated_end_time))
        .map((reservation) => reservation.vehicle_id));
      const available_vehicle_ids = Number.isSafeInteger(seats) && seats > 0 && +new Date(start) < +new Date(booking.estimated_end_time)
        ? readyVehicles.filter((vehicle) => vehicle.seat_count >= seats && !busyVehicles.has(vehicle.vehicle_id)).map((vehicle) => vehicle.vehicle_id)
        : [];
      return { booking, assignment: latest.get(booking.booking_id) || null, workflow, available_vehicle_ids };
    }),
    drivers: drivers.map((d) => ({ driver_id: d.driver_id, full_name: d.user?.full_name || 'Tài xế', phone: d.user?.phone, status: d.user?.status, availability_status: d.availability_status, license_expiry: d.license_expiry, approved: Boolean(d.approved_at) })),
    vehicles,
    incidents: incidents.map((incident) => ({
      ...incident,
      workflow_stage: incident.garage_damage_inspection_id
        ? null : incidentWorkflows.find((item) => item.booking_id === incident.booking_id)?.stage || null,
      damage_report: reportsById.get(incident.garage_damage_inspection_id),
    })),
  };
}
async function assign(bookingId, input, operatorId) {
  // Gan xe va tai xe cho booking sau khi kiem tra kha nang dap ung lich trinh.
  const id = positive(bookingId, 'booking_id');
  const driverId = positive(input.driver_id, 'driver_id');
  const vehicleId = positive(input.vehicle_id, 'vehicle_id');
  const serviceType = input.service_type;
  if (!['one_way', 'round_trip', 'tour'].includes(serviceType)) throw new HttpError(400, 'Loại dịch vụ không hợp lệ');
  const returnTime = serviceType === 'round_trip' ? date(input.return_pickup_time, 'return_pickup_time') : null;

  return retryDuplicateId(['assignment_id', 'booking_id'], () => runInTransaction(async (session) => {
    const booking = await Booking.findOne({ booking_id: id }).session(session).lean();
    if (!booking) throw new HttpError(404, 'Không tìm thấy booking');
    const bookedService = booking.service_type === 'roundtrip' ? 'round_trip' : booking.service_type;
    if (bookedService && serviceType !== bookedService) {
      throw new HttpError(409, 'Phân công phải giữ đúng loại dịch vụ khách đã đặt.');
    }
    if (booking.cancellation?.status === 'pending') throw new HttpError(409, 'Booking đang chờ xử lý hủy');
    if (booking.booking_status !== 'confirmed') {
      throw new HttpError(409, 'Chỉ phân công mới cho booking đã được Operator xác nhận');
    }
    if (!await lockVehicleSchedule(vehicleId, session)) throw new HttpError(404, 'Không tìm thấy xe');
    const existing = await TripWorkflow.findOne({ booking_id: id }).session(session);
    if (existing?.vehicle_received || existing?.stage === 'vehicle_replacement_required') {
      throw new HttpError(409, 'Xe đã được bàn giao hoặc chuyến đang chờ đổi xe');
    }
    if (serviceType === 'tour' && !await TripStop.exists({ booking_id: id }).session(session)) {
      throw new HttpError(409, 'Booking chưa có điểm dừng; hãy cập nhật lịch trình ở luồng 4 trước khi phân công tour');
    }
    if (returnTime && (returnTime <= new Date(booking.pickup_time) || returnTime >= new Date(booking.estimated_end_time))) {
      throw new HttpError(400, 'Giờ đón lượt về phải nằm sau giờ đón khách và trước thời gian kết thúc dự kiến');
    }

    const resources = await availability({ booking, driverId, vehicleId, excludeBookingId: id }, session);
    const [latest] = await assignmentsForBooking(id, session);
    const record = existing || new TripWorkflow({ booking_id: id, created_at: now(), history: [] });
    Object.assign(record, {
      service_type: serviceType, return_pickup_time: returnTime,
      return_pickup_location: returnTime ? text(input.return_pickup_location || booking.return_pickup_location || booking.dropoff_location, 'Điểm đón lượt về', 255) : null,
      return_dropoff_location: returnTime ? text(input.return_dropoff_location || (booking.service_type ? booking.dropoff_location : booking.pickup_location), 'Điểm trả lượt về', 255) : null,
      driver_id: driverId, vehicle_id: vehicleId, driver_response: 'pending', stage: 'awaiting_driver', leg: 'outbound',
      vehicle_received: false, vehicle_returned: false, handover_inspection_id: null, return_inspection_id: null,
      completed_stops: [], delay_minutes: 0, delay_reason: null,
      vehicle_received_at: null, vehicle_returned_at: null, started_at: null, picked_up_at: null,
      outbound_completed_at: null, return_started_at: null, ended_at: null,
      resume_stage: null, start_odometer: null, end_odometer: null, report_summary: null, report_created_at: null,
    });
    if (latest && ACTIVE_ASSIGNMENTS.includes(latest.assignment_status)) {
      await TripAssignment.updateOne({ assignment_id: latest.assignment_id }, { $set: { assignment_status: 'cancelled' } }, { session });
    }
    addTripHistory(record, existing ? 'reassigned' : 'assigned', operatorId, `Xe ${resources.vehicle.plate_number}; tài xế ${resources.user.full_name}`);
    await record.save({ session });
    const assignment_id = await nextId(TripAssignment, 'assignment_id', session);
    await TripAssignment.create([{
      assignment_id, booking_id: id, driver_id: driverId, assigned_by: operatorId, assigned_at: now(), assignment_status: 'assigned',
    }], { session });
    await Booking.updateOne({ booking_id: id }, { $set: {
      vehicle_id: vehicleId,
      ...(booking.requested_seats == null && booking.requested_seat_count == null && { requested_seat_count: resources.seats }),
    } }, { session });
    await syncDriverAvailability(driverId, session);
    if (latest?.driver_id && latest.driver_id !== driverId) await syncDriverAvailability(latest.driver_id, session);
    return record.toObject();
  }));
}

async function finishVehicleReturn(bookingId, driverId, actorId) {
  // Dong buoc tra xe cua Driver sau khi Gara da ghi nhan kiem tra tiep nhan.
  return retryDuplicateId(['maintenance_id'], () => runInTransaction(async (session) => {
    if (!session) throw new HttpError(503, 'Cần MongoDB replica set để xác nhận trả xe');
    const workflow = await TripWorkflow.findOne({ booking_id: bookingId, driver_id: driverId }).session(session);
    if (!workflow) throw new HttpError(404, 'Không tìm thấy chuyến được giao cho bạn');
    if (!['awaiting_vehicle_return', 'vehicle_return_issue'].includes(workflow.stage) || workflow.end_odometer == null) {
      throw new HttpError(409, 'Chuyến chưa tới bước xác nhận trả xe');
    }
    if (workflow.return_inspection_id === null) {
      throw new HttpError(409, 'Gara cần ghi nhận đã tiếp nhận xe sau chuyến');
    }
    const inspection = await VehicleInspection.findOne({
      booking_id: bookingId, vehicle_id: workflow.vehicle_id, inspection_type: 'return',
      result: { $in: ['pass', 'passed', 'fail', 'failed'] },
      ...(workflow.return_inspection_id !== undefined && { inspection_id: workflow.return_inspection_id }),
    }).sort({ inspected_at: -1, inspection_id: -1 }).session(session).lean();
    if (!inspection) throw new HttpError(409, 'Gara cần ghi nhận đã tiếp nhận xe sau chuyến');
    const assignment = await TripAssignment.findOne({ booking_id: bookingId })
      .sort({ assigned_at: -1, assignment_id: -1 }).session(session);
    if (assignment?.driver_id !== driverId || !ACTIVE_ASSIGNMENTS.includes(assignment.assignment_status)) {
      throw new HttpError(409, 'Phân công không còn hiệu lực');
    }
    const vehicle = await lockVehicleSchedule(workflow.vehicle_id, session);
    if (!vehicle) throw new HttpError(409, 'Không tìm thấy xe được phân công');

    workflow.return_inspection_id = inspection.inspection_id;
    workflow.vehicle_returned = true;
    workflow.vehicle_returned_at = now();
    workflow.stage = 'completed';
    workflow.resume_stage = null;
    addTripHistory(workflow, 'vehicle_returned', actorId);
    await workflow.save({ session });
    await Booking.updateOne({ booking_id: bookingId }, { $set: { booking_status: 'completed' } }, { session });
    assignment.assignment_status = 'completed';
    await assignment.save({ session });
    await syncDriverAvailability(driverId, session);

    if (['passed', 'pass'].includes(inspection.result)) {
      await releaseVehicleIfReady(vehicle, session, 'in_use');
    } else {
      await Vehicle.updateOne({ vehicle_id: vehicle.vehicle_id }, { $set: { status: 'maintenance' } }, { session });
      const linked = inspection.maintenance_id != null && await MaintenanceRecord.exists({
        ...openMaintenance(vehicle.vehicle_id), maintenance_id: inspection.maintenance_id,
      }).session(session);
      if (!linked) {
        const maintenance_id = await openForDamage({
          vehicleId: vehicle.vehicle_id, staffId: inspection.staff_id,
          description: inspection.condition_note || 'Kiểm tra tiếp nhận xe không đạt',
        }, session);
        const key = { inspection_id: inspection.inspection_id };
        await VehicleInspection.updateOne(key, { $set: { maintenance_id } }, { session });
        await VehicleDamage.updateOne(key, { $set: { maintenance_id } }, { session });
      }
    }
    return workflow.toObject();
  }));
}

async function mutateDriver(bookingId, actorId, action, input = {}) {
  // Xu ly phan hoi phan cong va cac cap nhat hanh trinh do Driver gui len.
  const id = positive(bookingId, 'booking_id');
  const profile = await DriverProfile.findOne({ user_id: actorId }).lean();
  if (!profile) throw new HttpError(404, 'Tài khoản chưa có hồ sơ tài xế');
  if (action === 'vehicle_received' || action === 'vehicle_declined') {
    return handovers.respond(id, profile.driver_id, actorId, action, input);
  }
  if (action === 'vehicle_returned') return finishVehicleReturn(id, profile.driver_id, actorId);
  const workflow = await TripWorkflow.findOne({ booking_id: id });
  if (!workflow || workflow.driver_id !== profile.driver_id) throw new HttpError(404, 'Không tìm thấy chuyến được giao cho bạn');
  const assignments = await assignmentsForBooking(id);
  const latest = assignments[0];
  if (!latest || latest.driver_id !== workflow.driver_id || ['rejected', 'cancelled'].includes(latest.assignment_status)) throw new HttpError(409, 'Phân công không còn hiệu lực');
  if (action === 'accept') {
    if (workflow.driver_response !== 'pending') throw new HttpError(409, 'Phân công này đã được phản hồi');
    workflow.driver_response = 'accepted'; workflow.stage = workflow.vehicle_received ? workflow.resume_stage || 'to_pickup' : 'awaiting_vehicle'; if (workflow.vehicle_received) workflow.resume_stage = null; await TripAssignment.updateOne({ assignment_id: latest.assignment_id }, { $set: { assignment_status: 'accepted' } });
  } else if (action === 'reject') {
    if (workflow.driver_response !== 'pending') throw new HttpError(409, 'Phân công này đã được phản hồi');
    const reason = text(input.reason, 'Lý do từ chối', 500);
    workflow.driver_response = 'rejected'; workflow.stage = 'reassignment_required'; await TripAssignment.updateOne({ assignment_id: latest.assignment_id }, { $set: { assignment_status: 'rejected' } });
    await syncDriverAvailability(workflow.driver_id);
    addTripHistory(workflow, 'driver_rejected', actorId, reason);
    await workflow.save();
    return workflow.toObject();
  } else if (action === 'update') {
    if (!workflow.vehicle_received) throw new HttpError(409, 'Cần nhận bàn giao xe trước khi bắt đầu');
    const kind = input.kind;
    const statuses = {
      arrived_pickup: ['to_pickup', 'Đã đến điểm đón'], picked_up: [null, 'Đã đón khách'],
      outbound_completed: ['outbound', 'Hoàn thành lượt đi'], return_pickup: ['return_waiting', 'Đã đón khách lượt về'],
      return_completed: ['return', 'Hoàn thành lượt về'], delayed: [null, 'Báo chậm lịch'],
      stop_completed: ['tour', 'Hoàn thành điểm dừng'], return_unavailable: ['return_waiting', 'Không thể nhận lượt về'],
    };
    if (!statuses[kind]) throw new HttpError(400, 'Cập nhật hành trình không hợp lệ');
    const expected = statuses[kind][0];
    if (expected && workflow.service_type !== expected && workflow.stage !== expected) throw new HttpError(409, 'Bước này chưa thể thực hiện ở trạng thái hiện tại');
    if (kind === 'arrived_pickup') workflow.stage = 'at_pickup';
    if (kind === 'picked_up') {
      if (!['to_pickup', 'at_pickup'].includes(workflow.stage)) throw new HttpError(409, 'Chưa thể xác nhận đón khách');
      workflow.stage = workflow.service_type === 'tour' ? 'tour' : 'outbound'; workflow.started_at ||= now(); workflow.picked_up_at = now(); await Booking.updateOne({ booking_id: id }, { $set: { booking_status: 'in_progress' } }); await Vehicle.updateOne({ vehicle_id: workflow.vehicle_id }, { $set: { status: 'in_use' } });
    }
    if (kind === 'outbound_completed') {
      if (!['one_way', 'round_trip'].includes(workflow.service_type) || workflow.stage !== 'outbound') throw new HttpError(409, 'Không ở lượt đi');
      workflow.stage = workflow.service_type === 'round_trip' ? 'return_waiting' : 'awaiting_report';
      workflow.outbound_completed_at = now();
      if (workflow.service_type === 'round_trip') workflow.leg = 'return';
    }
    if (kind === 'return_pickup') {
      if (workflow.service_type !== 'round_trip' || workflow.stage !== 'return_waiting') throw new HttpError(409, 'Chưa đến bước đón lượt về');
      if (workflow.return_pickup_time && now() < workflow.return_pickup_time) throw new HttpError(409, 'Chưa đến giờ đón khách lượt về');
      workflow.stage = 'return';
      workflow.return_started_at = now();
    }
    if (kind === 'return_unavailable') {
      if (workflow.service_type !== 'round_trip' || workflow.stage !== 'return_waiting') throw new HttpError(409, 'Chỉ có thể yêu cầu đổi tài xế ở lượt về');
      workflow.stage = 'return_reassignment_required'; workflow.resume_stage = 'return_waiting';
      workflow.delay_reason = text(input.reason, 'Lý do cần thay tài xế', 500);
    }
    if (kind === 'return_completed') {
      if (workflow.service_type !== 'round_trip' || workflow.stage !== 'return') throw new HttpError(409, 'Chưa thể hoàn thành lượt về');
      workflow.stage = 'awaiting_report';
    }
    if (kind === 'stop_completed') {
      if (workflow.service_type !== 'tour' || workflow.stage !== 'tour') throw new HttpError(409, 'Chuyến này không phải tour đang chạy');
      const stopId = positive(input.stop_id, 'stop_id');
      const stops = await TripStop.find({ booking_id: id }).sort({ stop_order: 1 }).lean();
      const next = stops.find((stop) => !workflow.completed_stops.includes(stop.stop_id));
      if (!next || next.stop_id !== stopId) throw new HttpError(409, 'Cần hoàn thành lần lượt các điểm dừng');
      workflow.completed_stops.push(stopId);
      if (workflow.completed_stops.length === stops.length) workflow.stage = 'awaiting_report';
    }
    if (kind === 'delayed') {
      if (!['to_pickup', 'at_pickup', 'outbound', 'tour', 'return_waiting', 'return'].includes(workflow.stage)) throw new HttpError(409, 'Chỉ báo chậm khi chuyến đang diễn ra');
      const minutes = Number(input.minutes);
      if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1440) throw new HttpError(400, 'Số phút chậm không hợp lệ');
      workflow.delay_minutes += minutes; workflow.delay_reason = text(input.reason, 'Lý do chậm', 500);
    }
    await TripStatusUpdate.create({ update_id: await nextId(TripStatusUpdate, 'update_id'), booking_id: id, updated_by: actorId, trip_status: kind, updated_at: now() });
  } else if (action === 'report') {
    if (workflow.stage !== 'awaiting_report') throw new HttpError(409, 'Chỉ gửi báo cáo sau khi hoàn thành dịch vụ');
    const odometer = input.end_odometer;
    const km = typeof odometer === 'string' && odometer.trim() ? Number(odometer) : odometer;
    if (!Number.isFinite(km) || km < 0 || (workflow.start_odometer != null && km < workflow.start_odometer)) throw new HttpError(400, 'Số km kết thúc phải lớn hơn hoặc bằng km nhận xe');
    const summary = typeof input.summary === 'string' ? input.summary.trim() : input.summary;
    if (summary != null && (typeof summary !== 'string' || summary.length > 2000)) {
      throw new HttpError(400, 'Ghi chú sau chuyến phải là văn bản, tối đa 2000 ký tự');
    }
    const endedAt = now();
    workflow.set({
      end_odometer: km,
      report_summary: summary || null,
      report_created_at: endedAt,
      ended_at: endedAt,
      stage: 'awaiting_vehicle_return',
    });
  }
  const actionName = action === 'update' ? input.kind : action;
  const note = action === 'report' ? workflow.report_summary : input.reason || input.summary || null;
  addTripHistory(workflow, actionName, actorId, note);
  await workflow.save();
  return workflow.toObject();
}
async function driverTrips(userId) {
  // Lay cac chuyen va bien ban ban giao xe thuoc tai khoan Driver hien tai.
  const profile = await DriverProfile.findOne({ user_id: userId }).lean();
  if (!profile) throw new HttpError(404, 'Tài khoản chưa có hồ sơ tài xế');
  const workflows = await TripWorkflow.find({ driver_id: profile.driver_id }).sort({ updated_at: -1 }).lean();
  const ids = workflows.map((w) => w.booking_id);
  const bookings = await Booking.find({ booking_id: { $in: ids } }).populate({ path: 'vehicle', select: 'plate_number brand model -_id' }).populate({ path: 'renter', select: 'full_name phone -_id' }).lean();
  const stops = await TripStop.find({ booking_id: { $in: ids } }).sort({ booking_id: 1, stop_order: 1 }).lean();
  const records = await handovers.driverRecords(workflows.map((workflow) => workflow.handover_inspection_id), profile.driver_id);
  return workflows.map((workflow) => ({
    workflow,
    booking: bookings.find((booking) => booking.booking_id === workflow.booking_id),
    stops: stops.filter((stop) => stop.booking_id === workflow.booking_id),
    handover: records.get(workflow.handover_inspection_id),
  }));
}
async function reportIncident(bookingId, driverUserId, input) {
  // Ghi nhan su co, xe hong hoac yeu cau doi diem dung de Operator xu ly.
  const booking_id = positive(bookingId, 'booking_id');
  const profile = await DriverProfile.findOne({ user_id: driverUserId }).lean();
  if (!profile) throw new HttpError(404, 'Không tìm thấy chuyến được giao cho bạn');
  const description = text(input.description, 'Mô tả sự cố', 2000);
  const { kind } = input;
  if (!['other', 'vehicle_failure', 'customer_route_change'].includes(kind)) throw new HttpError(400, 'Loại sự cố không hợp lệ');

  const filter = { booking_id, driver_id: profile.driver_id };
  return retryDuplicateId(['incident_id', 'maintenance_id'], () => runInTransaction(async (session) => {
    let workflow = await TripWorkflow.findOne(filter).session(session);
    if (!workflow) throw new HttpError(404, 'Không tìm thấy chuyến được giao cho bạn');
    if (kind === 'vehicle_failure') {
      const { vehicle_id } = workflow;
      if (!await lockVehicleSchedule(vehicle_id, session)) throw new HttpError(409, 'Không tìm thấy xe đang phân công');
      if (!session) workflow = await TripWorkflow.findOne({ ...filter, vehicle_id });
    }
    if (!workflow || ['completed', 'cancelled', 'vehicle_replacement_required'].includes(workflow.stage)) {
      throw new HttpError(409, 'Chuyến đã kết thúc hoặc đang chờ đổi xe');
    }
    const incident_id = await nextId(Incident, 'incident_id', session);
    await Incident.create([{
      incident_id, booking_id, reported_by: driverUserId, description, kind, reported_at: now(), incident_status: 'open',
      resolution_note: null, resolved_by: null,
    }], { session });
    workflow.incident_ids.push(incident_id);
    workflow.resume_stage = workflow.stage;
    if (kind === 'vehicle_failure') {
      workflow.stage = 'vehicle_replacement_required';
      await Vehicle.updateOne({ vehicle_id: workflow.vehicle_id }, { $set: { status: 'maintenance' } }, { session });
      const bookingCode = 'VT-' + String(booking_id).padStart(6, '0');
      await openForDamage({
        vehicleId: workflow.vehicle_id, staffId: driverUserId,
        description: `Báo hỏng trong chuyến ${bookingCode}: ${description}`, requiresApproval: true,
      }, session);
    } else {
      workflow.stage = kind === 'customer_route_change' ? 'routed_to_booking_changes' : 'incident_open';
    }
    addTripHistory(workflow, 'incident_reported', driverUserId, description);
    await workflow.save({ session });
    return { incident_id, workflow: workflow.toObject() };
  }));
}
async function resolveIncident(bookingId, incidentId, operatorId, note) {
  // Ghi ket qua xu ly su co va khoi phuc trang thai workflow neu phu hop.
  const id = positive(bookingId, 'booking_id');
  const resolution = text(note, 'Biện pháp xử lý', 2000);
  return runInTransaction(async (session) => {
    const booking = await Booking.findOne({ booking_id: id }).session(session);
    if (!booking) throw new HttpError(404, 'Không tìm thấy booking');
    const incident = await Incident.findOne({ booking_id: id, incident_id: positive(incidentId, 'incident_id'), incident_status: 'open' }).session(session);
    if (!incident) throw new HttpError(409, 'Sự cố đã được xử lý');
    const approval = incident.resolution_approval;
    if (approval && approval.status !== 'approved') throw new HttpError(409, 'Phương án cần Manager phê duyệt trước khi đóng');
    if (['accident', 'complaint'].includes(incident.kind) && approval?.status !== 'approved') throw new HttpError(409, 'Sự cố đặc biệt cần trình Manager');
    const workflow = incident.garage_damage_inspection_id ? null : await TripWorkflow.findOne({ booking_id: id }).session(session);
    if (workflow?.stage === 'routed_to_booking_changes') throw new HttpError(409, 'Cần xử lý thay đổi lịch trình trước khi đóng');
    if (workflow?.stage === 'vehicle_replacement_required') throw new HttpError(409, 'Cần đổi xe trước khi đóng sự cố hỏng xe');
    if (approval?.action === 'replace_driver' && workflow?.driver_response !== 'accepted') throw new HttpError(409, 'Tài xế thay thế cần chấp nhận phân công trước khi đóng sự cố');
    if (approval?.action === 'replace_driver' && !workflow?.history?.some((item) => ['assigned', 'reassigned', 'return_driver_reassigned', 'incident_driver_reassigned'].includes(item.action) && item.created_at >= approval.requested_at)) throw new HttpError(409, 'Cần hoàn tất phân công lại tài xế trước khi đóng');
    if (approval?.action === 'change_itinerary' && !workflow?.history?.some((item) => item.action === 'booking_change_approved' && item.created_at >= approval.requested_at)) throw new HttpError(409, 'Cần duyệt lịch trình mới trước khi đóng');
    if (approval?.action === 'replace_vehicle' && workflow?.history?.filter((item) => item.action === 'vehicle_replaced' && item.created_at >= approval.requested_at).length === 0) throw new HttpError(409, 'Cần hoàn tất đổi xe trước khi đóng');
    incident.incident_status = 'resolved'; incident.resolution_note = resolution;
    incident.resolved_by = operatorId; incident.resolved_at = now();
    incident.history.push({ action: 'resolved', actor_id: operatorId, at: now(), note: resolution });
    await incident.save({ session });
    const otherOpen = await Incident.exists({ booking_id: id, incident_status: 'open', garage_damage_inspection_id: null }).session(session);
    if (workflow && !otherOpen && workflow.stage === 'incident_open') {
      workflow.stage = workflow.resume_stage || 'reassignment_required'; workflow.resume_stage = null;
      addTripHistory(workflow, 'incident_resolved', operatorId, resolution);
      await workflow.save({ session });
    }
    booking.operation_events.push({ action: 'incident_resolved', actor_id: operatorId, at: now(), note: resolution });
    await booking.save({ session });
    return incident.toObject();
  });
}
async function replaceVehicle(bookingId, vehicleId, operatorId) {
  // Thay xe khi xe dang dieu phoi gap su co hoac khong the tiep tuc chuyen.
  const id = positive(bookingId, 'booking_id');
  const newVehicleId = positive(vehicleId, 'vehicle_id');
  return runInTransaction(async (session) => {
    const vehicle = await lockVehicleSchedule(newVehicleId, session);
    const workflow = await TripWorkflow.findOne({ booking_id: id }).session(session);
    const booking = await Booking.findOne({ booking_id: id }).session(session).lean();
    if (!workflow || !booking || workflow.stage !== 'vehicle_replacement_required') {
      throw new HttpError(409, 'Chuyến chưa có yêu cầu đổi xe');
    }
    if (!vehicle || !vehicleCanDispatch(vehicle)) throw new HttpError(409, 'Xe thay thế không sẵn sàng');
    const seats = await assertTripVehicleSeats(booking, vehicle, session);
    if (await MaintenanceRecord.exists(openMaintenance(newVehicleId)).session(session)) {
      throw new HttpError(409, 'Xe thay thế đang bảo dưỡng');
    }
    if (await latestInspectionFailed(newVehicleId, session)) {
      throw new HttpError(409, 'Xe thay thế có lần kiểm tra gần nhất không đạt');
    }
    const otherBookings = await Booking.find({
      vehicle_id: newVehicleId, booking_status: { $in: RESERVED_VEHICLE_STATUSES }, booking_id: { $ne: id },
    }).select('pickup_time estimated_end_time -_id').session(session).lean();
    if (otherBookings.some((other) => windowsOverlap(now(), booking.estimated_end_time, other.pickup_time, other.estimated_end_time))) {
      throw new HttpError(409, 'Xe thay thế đã có lịch trùng');
    }

    workflow.resume_stage ||= 'to_pickup';
    workflow.set({
      vehicle_id: newVehicleId, vehicle_received: false, vehicle_received_at: null, start_odometer: null,
      stage: 'awaiting_vehicle', handover_inspection_id: null, return_inspection_id: null,
    });
    await Booking.updateOne({ booking_id: id }, { $set: {
      vehicle_id: newVehicleId,
      ...(booking.requested_seats == null && booking.requested_seat_count == null && { requested_seat_count: seats }),
    } }, { session });
    await Incident.updateMany({ booking_id: id, incident_status: 'open', garage_damage_inspection_id: null, 'resolution_approval.id': { $exists: false }, kind: { $nin: ['accident', 'complaint'] } }, {
      $set: { incident_status: 'resolved', resolution_note: `Đã điều phối xe thay thế ${vehicle.plate_number}`, resolved_by: operatorId },
    }, { session });
    addTripHistory(workflow, 'vehicle_replaced', operatorId, `Xe thay thế ${vehicle.plate_number}; chờ gara bàn giao`);
    await workflow.save({ session });
    return workflow.toObject();
  });
}
async function reassignReturn(bookingId, driverId, operatorId) {
  // Gan tai xe khac cho rieng chang ve khi tai xe cu khong the tiep tuc.
  const id = positive(bookingId, 'booking_id');
  const workflow = await TripWorkflow.findOne({ booking_id: id });
  const booking = await Booking.findOne({ booking_id: id }).lean();
  if (!workflow || workflow.service_type !== 'round_trip' || !['return_reassignment_required', 'return_waiting'].includes(workflow.stage)) throw new HttpError(409, 'Booking không ở bước cần thay tài xế lượt về');
  const returnBooking = { ...booking, pickup_time: workflow.return_pickup_time || now() };
  const resources = await availability({ booking: returnBooking, driverId: positive(driverId, 'driver_id'), vehicleId: workflow.vehicle_id, excludeBookingId: id });
  const [latest] = await assignmentsForBooking(id);
  if (latest) await TripAssignment.updateOne({ assignment_id: latest.assignment_id }, { $set: { assignment_status: 'cancelled' } });
  workflow.driver_id = driverId; workflow.driver_response = 'accepted'; workflow.stage = 'return_waiting'; workflow.resume_stage = null; workflow.leg = 'return';
  await TripAssignment.create({ assignment_id: await nextId(TripAssignment, 'assignment_id'), booking_id: id, driver_id: driverId, assigned_by: operatorId, assigned_at: now(), assignment_status: 'accepted' });
  await syncDriverAvailability(driverId);
  if (latest) await syncDriverAvailability(latest.driver_id);
  addTripHistory(workflow, 'return_driver_reassigned', operatorId, `Tài xế lượt về: ${resources.user.full_name}`);
  await workflow.save();
  return workflow.toObject();
}
async function replaceIncidentDriver(incidentId, driverId, operatorId, reason) {
  // Thay tai xe cho chuyen co su co va luu ly do dieu phoi lai.
  return retryDuplicateId(['assignment_id'], () => runInTransaction(async (session) => {
    const incident = await Incident.findOne({ incident_id: incidentId, incident_status: 'open', 'resolution_approval.status': 'approved', 'resolution_approval.action': 'replace_driver' }).session(session);
    if (!incident) throw new HttpError(409, 'Cần phương án đổi tài xế đã được Manager duyệt');
    const workflow = await TripWorkflow.findOne({ booking_id: incident.booking_id }).session(session);
    const booking = await Booking.findOne({ booking_id: incident.booking_id }).session(session).lean();
    if (!workflow || !booking || !['confirmed', 'in_progress'].includes(booking.booking_status)) throw new HttpError(409, 'Chuyến không đủ điều kiện đổi tài xế');
    if (workflow.driver_id === driverId) throw new HttpError(400, 'Chọn tài xế khác tài xế hiện tại');
    await lockVehicleSchedule(workflow.vehicle_id, session);
    await availability({ booking: { ...booking, pickup_time: new Date(Math.max(+new Date(booking.pickup_time), Date.now())) }, driverId, vehicleId: workflow.vehicle_id, excludeBookingId: booking.booking_id }, session);
    const oldDriver = workflow.driver_id;
    await TripAssignment.updateMany({ booking_id: booking.booking_id, assignment_status: { $in: ACTIVE_ASSIGNMENTS } }, { $set: { assignment_status: 'cancelled' } }, { session });
    await TripAssignment.create([{ assignment_id: await nextId(TripAssignment, 'assignment_id', session), booking_id: booking.booking_id, driver_id: driverId, assigned_by: operatorId, assigned_at: now(), assignment_status: 'assigned' }], { session });
    workflow.driver_id = driverId; workflow.driver_response = 'pending';
    if (workflow.stage !== 'awaiting_driver') workflow.resume_stage ||= workflow.stage;
    workflow.stage = 'awaiting_driver';
    addTripHistory(workflow, 'incident_driver_reassigned', operatorId, reason);
    await workflow.save({ session });
    await syncDriverAvailability(oldDriver, session); await syncDriverAvailability(driverId, session);
    return workflow.toObject();
  }));
}
module.exports = { replaceIncidentDriver, dispatchData, assign, mutateDriver, driverTrips, reportIncident, resolveIncident, replaceVehicle, reassignReturn };
