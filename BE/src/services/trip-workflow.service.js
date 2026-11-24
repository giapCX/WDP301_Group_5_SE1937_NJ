const mongoose = require('mongoose');
const {
  Booking, DriverProfile, Incident, MaintenanceRecord, TripAssignment,
  TripStatusUpdate, TripStop, TripWorkflow, User, Vehicle, VehicleInspection,
} = require('../models');
const HttpError = require('../utils/http-error');

const ACTIVE_ASSIGNMENTS = ['assigned', 'accepted', 'in_progress'];
const CLOSED_MAINTENANCE = ['completed', 'closed', 'cancelled'];
const now = () => new Date();
function positive(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new HttpError(400, `${field} không hợp lệ`);
  return number;
}
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
async function nextId(Model, field) {
  const [last] = await Model.find().sort({ [field]: -1 }).select(`${field} -_id`).limit(1).lean();
  return (last?.[field] || 0) + 1;
}
async function ensureMaintenance(vehicleId, reportedBy, description) {
  const open = await MaintenanceRecord.exists({ vehicle_id: vehicleId, maintenance_status: { $nin: CLOSED_MAINTENANCE } });
  if (open) return;
  await MaintenanceRecord.create({
    maintenance_id: await nextId(MaintenanceRecord, 'maintenance_id'), vehicle_id: vehicleId,
    reported_by: reportedBy, description, maintenance_status: 'in_progress', started_at: now(), completed_at: null,
  });
}
async function syncDriverAvailability(driverId) {
  const [profile, activeAssignment] = await Promise.all([
    DriverProfile.findOne({ driver_id: driverId }).select('availability_status').lean(),
    TripAssignment.exists({ driver_id: driverId, assignment_status: { $in: ACTIVE_ASSIGNMENTS } }),
  ]);
  if (!profile || profile.availability_status === 'unavailable') return;
  await DriverProfile.updateOne({ driver_id: driverId }, { $set: { availability_status: activeAssignment ? 'busy' : 'available' } });
}
async function audit(workflow, action, actorId, note = null) {
  workflow.history.push({ action, actor_id: actorId, note, created_at: now() });
  workflow.updated_at = now();
}
function windowsOverlap(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}
async function assignmentsForBooking(bookingId) {
  return TripAssignment.find({ booking_id: bookingId }).sort({ assigned_at: -1, assignment_id: -1 }).lean();
}
async function availability({ booking, driverId, vehicleId, excludeBookingId }) {
  const start = new Date(booking.pickup_time);
  const end = new Date(booking.estimated_end_time);
  const driver = await DriverProfile.findOne({ driver_id: driverId }).lean();
  if (!driver) throw new HttpError(404, 'Không tìm thấy hồ sơ tài xế');
  const existingWorkflow = excludeBookingId ? await TripWorkflow.findOne({ booking_id: excludeBookingId, driver_id: driverId }).lean() : null;
  const sameBookingReassignment = existingWorkflow && ['awaiting_driver', 'reassignment_required', 'vehicle_replacement_required', 'incident_open'].includes(existingWorkflow.stage);
  if (driver.availability_status === 'unavailable' || (!['available', 'busy'].includes(driver.availability_status) && !sameBookingReassignment)) throw new HttpError(409, 'Tài xế hiện không ở trạng thái sẵn sàng');
  if (!driver.approved_at) throw new HttpError(409, 'Hồ sơ tài xế chưa được duyệt');
  if (!driver.license_expiry || new Date(driver.license_expiry) < end) throw new HttpError(409, 'Giấy phép tài xế hết hạn trước khi chuyến kết thúc');
  const user = await User.findOne({ user_id: driver.user_id, status: 'active' }).select('user_id full_name phone status -_id').lean();
  if (!user) throw new HttpError(409, 'Tài khoản tài xế không hoạt động');
  const vehicle = await Vehicle.findOne({ vehicle_id: vehicleId }).lean();
  if (!vehicle) throw new HttpError(404, 'Không tìm thấy xe');
  if (!['available', 'in_use'].includes(vehicle.status)) throw new HttpError(409, 'Xe đang bảo dưỡng hoặc không sẵn sàng');
  const maintenance = await MaintenanceRecord.findOne({ vehicle_id: vehicleId, maintenance_status: { $nin: CLOSED_MAINTENANCE } }).lean();
  if (maintenance) throw new HttpError(409, 'Xe đang có phiếu bảo dưỡng chưa hoàn tất');
  const failedInspection = await VehicleInspection.findOne({ vehicle_id: vehicleId, result: { $in: ['failed', 'fail'] } }).sort({ inspected_at: -1 }).lean();
  const passedAfterFailure = failedInspection && await VehicleInspection.exists({ vehicle_id: vehicleId, result: { $in: ['passed', 'pass'] }, inspected_at: { $gt: failedInspection.inspected_at } });
  if (failedInspection && !passedAfterFailure) throw new HttpError(409, 'Xe có biên bản kiểm tra không đạt, cần gara xác nhận đạt trước khi phân công');
  const leave = await mongoose.connection.collection('driver_unavailability').findOne({
    driver_id: driverId,
    status: { $nin: ['cancelled', 'rejected'] },
    start_at: { $lt: end }, end_at: { $gt: start },
  });
  if (leave) throw new HttpError(409, 'Tài xế có lịch nghỉ trùng thời gian chuyến');
  const overlapping = await TripAssignment.find({
    driver_id: driverId, booking_id: { $ne: excludeBookingId }, assignment_status: { $in: ACTIVE_ASSIGNMENTS },
  }).populate({ path: 'booking', select: 'pickup_time estimated_end_time -_id' }).lean();
  if (overlapping.some((item) => item.booking && windowsOverlap(start, end, item.booking.pickup_time, item.booking.estimated_end_time)))
    throw new HttpError(409, 'Tài xế đã được phân công một chuyến trùng lịch');
  const vehicleBookings = await Booking.find({ vehicle_id: vehicleId, booking_status: { $in: ['confirmed', 'in_progress'] }, booking_id: { $ne: excludeBookingId } }).select('booking_id pickup_time estimated_end_time -_id').lean();
  if (vehicleBookings.some((item) => windowsOverlap(start, end, item.pickup_time, item.estimated_end_time)))
    throw new HttpError(409, 'Xe đã có booking trùng thời gian');
  return { driver, user, vehicle };
}
async function dispatchData() {
  const allWorkflows = await TripWorkflow.find().lean();
  const activeIds = allWorkflows.filter((workflow) => workflow.stage !== 'completed').map((workflow) => workflow.booking_id);
  const bookings = await Booking.find({ booking_status: { $in: ['confirmed', 'in_progress'] } })
    .where({ $or: [{ booking_status: 'confirmed' }, { booking_id: { $in: activeIds } }] })
    .sort({ pickup_time: 1 }).populate({ path: 'renter', select: 'full_name phone -_id' })
    .populate({ path: 'vehicle', select: 'vehicle_id plate_number brand model status -_id' }).lean();
  const [drivers, vehicles, workflows] = await Promise.all([
    DriverProfile.find().populate({ path: 'user', select: 'full_name phone status -_id' }).lean(),
    Vehicle.find().select('vehicle_id plate_number brand model seat_count status -_id').lean(),
    Promise.resolve(allWorkflows.filter((workflow) => bookings.some((booking) => booking.booking_id === workflow.booking_id))),
  ]);
  const incidents = await Incident.find({ incident_status: 'open' }).sort({ incident_id: -1 }).lean();
  const incidentWorkflows = await TripWorkflow.find({ booking_id: { $in: incidents.map((incident) => incident.booking_id) } }).select('booking_id stage -_id').lean();
  const assigned = await TripAssignment.find({ booking_id: { $in: bookings.map((b) => b.booking_id) } }).sort({ assigned_at: -1, assignment_id: -1 }).lean();
  const latest = new Map();
  for (const item of assigned) if (!latest.has(item.booking_id)) latest.set(item.booking_id, item);
  return {
    bookings: bookings.map((booking) => ({ booking, assignment: latest.get(booking.booking_id) || null, workflow: workflows.find((w) => w.booking_id === booking.booking_id) || null })),
    drivers: drivers.map((d) => ({ driver_id: d.driver_id, full_name: d.user?.full_name || 'Tài xế', phone: d.user?.phone, status: d.user?.status, availability_status: d.availability_status, license_expiry: d.license_expiry, approved: Boolean(d.approved_at) })),
    vehicles,
    incidents: incidents.map((incident) => ({ ...incident, workflow_stage: incidentWorkflows.find((item) => item.booking_id === incident.booking_id)?.stage || null })),
  };
}
async function assign(bookingId, input, operatorId) {
  const booking = await Booking.findOne({ booking_id: positive(bookingId, 'booking_id') }).lean();
  if (!booking) throw new HttpError(404, 'Không tìm thấy booking');
  if (booking.booking_status !== 'confirmed') throw new HttpError(409, 'Chỉ phân công mới cho booking đã được Operator xác nhận');
  const driverId = positive(input.driver_id, 'driver_id');
  const vehicleId = positive(input.vehicle_id, 'vehicle_id');
  const serviceType = input.service_type;
  if (!['one_way', 'round_trip', 'tour'].includes(serviceType)) throw new HttpError(400, 'Loại dịch vụ không hợp lệ');
  if (serviceType === 'tour' && !(await TripStop.exists({ booking_id: booking.booking_id }))) throw new HttpError(409, 'Booking chưa có điểm dừng; hãy cập nhật lịch trình ở luồng 4 trước khi phân công tour');
  const returnTime = serviceType === 'round_trip' ? date(input.return_pickup_time, 'return_pickup_time') : null;
  if (returnTime && (returnTime <= new Date(booking.pickup_time) || returnTime >= new Date(booking.estimated_end_time)))
    throw new HttpError(400, 'Giờ đón lượt về phải nằm sau giờ đón khách và trước thời gian kết thúc dự kiến');
  const resources = await availability({ booking, driverId, vehicleId, excludeBookingId: booking.booking_id });
  const [latest] = await assignmentsForBooking(booking.booking_id);
  if (latest && !['rejected', 'cancelled', 'completed'].includes(latest.assignment_status)) {
    await TripAssignment.updateOne({ assignment_id: latest.assignment_id }, { $set: { assignment_status: 'cancelled' } });
  }
  const existing = await TripWorkflow.findOne({ booking_id: booking.booking_id });
  const record = existing || new TripWorkflow({ booking_id: booking.booking_id, created_at: now(), history: [] });
  Object.assign(record, {
    service_type: serviceType, return_pickup_time: returnTime,
    return_pickup_location: serviceType === 'round_trip' ? text(input.return_pickup_location || booking.dropoff_location, 'Điểm đón lượt về', 255) : null,
    return_dropoff_location: serviceType === 'round_trip' ? text(input.return_dropoff_location || booking.pickup_location, 'Điểm trả lượt về', 255) : null,
    driver_id: driverId, vehicle_id: vehicleId, driver_response: 'pending', stage: 'awaiting_driver', leg: 'outbound',
    vehicle_received: false, vehicle_returned: false, completed_stops: [], delay_minutes: 0, delay_reason: null,
    vehicle_received_at: null, vehicle_returned_at: null, started_at: null, picked_up_at: null,
    outbound_completed_at: null, return_started_at: null, ended_at: null,
    resume_stage: null,
    start_odometer: null, end_odometer: null, report_summary: null, report_created_at: null,
    incident_ids: record.incident_ids || [],
  });
  await audit(record, existing ? 'reassigned' : 'assigned', operatorId, `Xe ${resources.vehicle.plate_number}; tài xế ${resources.user.full_name}`);
  await record.save();
  await TripAssignment.create({ assignment_id: await nextId(TripAssignment, 'assignment_id'), booking_id: booking.booking_id, driver_id: driverId, assigned_by: operatorId, assigned_at: now(), assignment_status: 'assigned' });
  await Booking.updateOne({ booking_id: booking.booking_id }, { $set: { vehicle_id: vehicleId } });
  await syncDriverAvailability(driverId);
  const previousDriverId = latest?.driver_id;
  if (previousDriverId && previousDriverId !== driverId) await syncDriverAvailability(previousDriverId);
  return record.toObject();
}
async function mutateDriver(bookingId, actorId, action, input = {}) {
  const id = positive(bookingId, 'booking_id');
  const profile = await DriverProfile.findOne({ user_id: actorId }).lean();
  if (!profile) throw new HttpError(404, 'Tài khoản chưa có hồ sơ tài xế');
  const workflow = await TripWorkflow.findOne({ booking_id: id });
  if (!workflow || workflow.driver_id !== profile.driver_id) throw new HttpError(404, 'Không tìm thấy chuyến được giao cho bạn');
  if (!profile || profile.driver_id !== workflow.driver_id) throw new HttpError(403, 'Không thể cập nhật chuyến này');
  const booking = await Booking.findOne({ booking_id: id }).lean();
  const assignments = await assignmentsForBooking(id);
  const latest = assignments[0];
  if (!latest || latest.driver_id !== workflow.driver_id || ['rejected', 'cancelled'].includes(latest.assignment_status)) throw new HttpError(409, 'Phân công không còn hiệu lực');
  if (action === 'accept') {
    if (workflow.driver_response !== 'pending') throw new HttpError(409, 'Phân công này đã được phản hồi');
    workflow.driver_response = 'accepted'; workflow.stage = 'awaiting_vehicle'; await TripAssignment.updateOne({ assignment_id: latest.assignment_id }, { $set: { assignment_status: 'accepted' } });
  } else if (action === 'reject') {
    if (workflow.driver_response !== 'pending') throw new HttpError(409, 'Phân công này đã được phản hồi');
    const reason = text(input.reason, 'Lý do từ chối', 500);
    workflow.driver_response = 'rejected'; workflow.stage = 'reassignment_required'; await TripAssignment.updateOne({ assignment_id: latest.assignment_id }, { $set: { assignment_status: 'rejected' } });
    await syncDriverAvailability(workflow.driver_id);
    await audit(workflow, 'driver_rejected', actorId, reason); await workflow.save();
    return workflow.toObject();
  } else if (action === 'vehicle_received') {
    if (workflow.driver_response !== 'accepted' || workflow.stage !== 'awaiting_vehicle') throw new HttpError(409, 'Cần chấp nhận phân công trước');
    const inspection = await VehicleInspection.findOne({ booking_id: id, vehicle_id: workflow.vehicle_id, inspection_type: 'handover' }).sort({ inspected_at: -1, inspection_id: -1 }).lean();
    if (!inspection || !['passed', 'pass'].includes(inspection.result)) throw new HttpError(409, 'Gara chưa ghi nhận kiểm tra xe đạt cho booking này');
    if (!Number.isFinite(inspection.odometer)) throw new HttpError(409, 'Gara cần ghi số km trên biên bản bàn giao');
    const km = Number(input.odometer ?? inspection.odometer);
    if (!Number.isFinite(km) || km < 0) throw new HttpError(400, 'Số km nhận xe không hợp lệ');
    workflow.vehicle_received = true; workflow.vehicle_received_at = now(); workflow.start_odometer ??= km; workflow.stage = workflow.resume_stage || 'to_pickup'; workflow.resume_stage = null;
  } else if (action === 'update') {
    if (!workflow.vehicle_received) throw new HttpError(409, 'Cần nhận bàn giao xe trước khi bắt đầu');
    const kind = input.kind;
    const statuses = {
      arrived_pickup: ['to_pickup', 'Đã đến điểm đón'], picked_up: ['to_pickup', 'Đã đón khách'],
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
    const km = Number(input.end_odometer);
    if (!Number.isFinite(km) || km < 0 || (workflow.start_odometer != null && km < workflow.start_odometer)) throw new HttpError(400, 'Số km kết thúc phải lớn hơn hoặc bằng km nhận xe');
    workflow.end_odometer = km; workflow.report_summary = text(input.summary, 'Báo cáo sau chuyến', 2000); workflow.report_created_at = now(); workflow.ended_at = now(); workflow.stage = 'awaiting_vehicle_return';
  } else if (action === 'vehicle_returned') {
    if (workflow.stage !== 'awaiting_vehicle_return' || workflow.end_odometer == null) throw new HttpError(409, 'Cần gửi báo cáo trước khi trả xe');
    const passed = await VehicleInspection.exists({ booking_id: id, vehicle_id: workflow.vehicle_id, inspection_type: 'return', result: { $in: ['passed', 'pass'] } });
    if (!passed) throw new HttpError(409, 'Gara cần xác nhận đã tiếp nhận xe sau chuyến');
    workflow.vehicle_returned = true; workflow.vehicle_returned_at = now(); workflow.stage = 'completed';
    await Booking.updateOne({ booking_id: id }, { $set: { booking_status: 'completed' } });
    const [assignment] = assignments;
    if (assignment) await TripAssignment.updateOne({ assignment_id: assignment.assignment_id }, { $set: { assignment_status: 'completed' } });
    await syncDriverAvailability(workflow.driver_id);
    const openMaintenance = await MaintenanceRecord.exists({ vehicle_id: workflow.vehicle_id, maintenance_status: { $nin: CLOSED_MAINTENANCE } });
    if (!openMaintenance) await Vehicle.updateOne({ vehicle_id: workflow.vehicle_id }, { $set: { status: 'available' } });
  }
  const actionName = action === 'update' ? input.kind : action;
  await audit(workflow, actionName, actorId, input.reason || input.summary || null);
  await workflow.save();
  return workflow.toObject();
}
async function driverTrips(userId) {
  const profile = await DriverProfile.findOne({ user_id: userId }).lean();
  if (!profile) throw new HttpError(404, 'Tài khoản chưa có hồ sơ tài xế');
  const workflows = await TripWorkflow.find({ driver_id: profile.driver_id }).sort({ updated_at: -1 }).lean();
  const ids = workflows.map((w) => w.booking_id);
  const bookings = await Booking.find({ booking_id: { $in: ids } }).populate({ path: 'vehicle', select: 'plate_number brand model -_id' }).populate({ path: 'renter', select: 'full_name phone -_id' }).lean();
  const stops = await TripStop.find({ booking_id: { $in: ids } }).sort({ booking_id: 1, stop_order: 1 }).lean();
  return workflows.map((workflow) => ({ workflow, booking: bookings.find((b) => b.booking_id === workflow.booking_id), stops: stops.filter((s) => s.booking_id === workflow.booking_id) }));
}
async function reportIncident(bookingId, driverUserId, input) {
  const workflow = await TripWorkflow.findOne({ booking_id: positive(bookingId, 'booking_id') });
  const profile = await DriverProfile.findOne({ user_id: driverUserId }).lean();
  if (!workflow || !profile || workflow.driver_id !== profile.driver_id) throw new HttpError(404, 'Không tìm thấy chuyến được giao cho bạn');
  const description = text(input.description, 'Mô tả sự cố', 2000);
  if (!['other', 'vehicle_failure', 'customer_route_change'].includes(input.kind)) throw new HttpError(400, 'Loại sự cố không hợp lệ');
  const incidentId = await nextId(Incident, 'incident_id');
  await Incident.create({ incident_id: incidentId, booking_id: workflow.booking_id, reported_by: driverUserId, description, incident_status: 'open', resolution_note: null, resolved_by: null });
  workflow.incident_ids.push(incidentId);
  if (input.kind === 'vehicle_failure') { workflow.resume_stage = workflow.stage; workflow.stage = 'vehicle_replacement_required'; await Vehicle.updateOne({ vehicle_id: workflow.vehicle_id }, { $set: { status: 'maintenance' } }); await ensureMaintenance(workflow.vehicle_id, driverUserId, `Báo hỏng trong chuyến VT-${String(workflow.booking_id).padStart(6, '0')}: ${description}`); }
  else if (input.kind === 'customer_route_change') { workflow.resume_stage = workflow.stage; workflow.stage = 'routed_to_booking_changes'; }
  else { workflow.resume_stage = workflow.stage; workflow.stage = 'incident_open'; }
  await audit(workflow, 'incident_reported', driverUserId, description); await workflow.save();
  return { incident_id: incidentId, workflow: workflow.toObject() };
}
async function resolveIncident(bookingId, incidentId, operatorId, note) {
  const id = positive(bookingId, 'booking_id');
  const incident = await Incident.findOne({ booking_id: id, incident_id: positive(incidentId, 'incident_id'), incident_status: 'open' });
  if (!incident) throw new HttpError(404, 'Không tìm thấy sự cố đang mở');
  const activeWorkflow = await TripWorkflow.findOne({ booking_id: id }).lean();
  if (activeWorkflow?.stage === 'routed_to_booking_changes') throw new HttpError(409, 'Yêu cầu đã chuyển sang luồng 4; cần xử lý thay đổi lịch trình trước khi đóng');
  if (activeWorkflow?.stage === 'vehicle_replacement_required') throw new HttpError(409, 'Cần đổi xe trước khi đóng sự cố hỏng xe');
  incident.incident_status = 'resolved'; incident.resolution_note = text(note, 'Biện pháp xử lý', 2000); incident.resolved_by = operatorId; await incident.save();
  const workflow = await TripWorkflow.findOne({ booking_id: id });
  if (workflow) { workflow.stage = workflow.resume_stage || 'reassignment_required'; workflow.resume_stage = null; await audit(workflow, 'incident_resolved', operatorId, incident.resolution_note); await workflow.save(); }
  return incident.toObject();
}
async function replaceVehicle(bookingId, vehicleId, operatorId) {
  const id = positive(bookingId, 'booking_id');
  const workflow = await TripWorkflow.findOne({ booking_id: id });
  const booking = await Booking.findOne({ booking_id: id }).lean();
  if (!workflow || !booking || workflow.stage !== 'vehicle_replacement_required') throw new HttpError(409, 'Chuyến chưa có yêu cầu đổi xe');
  const vehicle = await Vehicle.findOne({ vehicle_id: positive(vehicleId, 'vehicle_id') }).lean();
  if (!vehicle || !['available', 'in_use'].includes(vehicle.status)) throw new HttpError(409, 'Xe thay thế không sẵn sàng');
  const maintenance = await MaintenanceRecord.exists({ vehicle_id: vehicle.vehicle_id, maintenance_status: { $nin: CLOSED_MAINTENANCE } });
  if (maintenance) throw new HttpError(409, 'Xe thay thế đang bảo dưỡng');
  const lastInspection = await VehicleInspection.findOne({ vehicle_id: vehicle.vehicle_id }).sort({ inspected_at: -1, inspection_id: -1 }).lean();
  if (lastInspection && ['failed', 'fail'].includes(lastInspection.result)) throw new HttpError(409, 'Xe thay thế có lần kiểm tra gần nhất không đạt');
  const otherBookings = await Booking.find({ vehicle_id: vehicle.vehicle_id, booking_status: { $in: ['confirmed', 'in_progress'] }, booking_id: { $ne: id } }).select('pickup_time estimated_end_time -_id').lean();
  if (otherBookings.some((b) => windowsOverlap(now(), booking.estimated_end_time, b.pickup_time, b.estimated_end_time))) throw new HttpError(409, 'Xe thay thế đã có lịch trùng');
  if (!workflow.resume_stage && !['awaiting_driver', 'awaiting_vehicle', 'vehicle_replacement_required'].includes(workflow.stage)) workflow.resume_stage = workflow.stage;
  if (!workflow.resume_stage) workflow.resume_stage = 'to_pickup';
  workflow.vehicle_id = vehicle.vehicle_id; workflow.vehicle_received = false; workflow.start_odometer = null; workflow.stage = 'awaiting_vehicle';
  await Booking.updateOne({ booking_id: id }, { $set: { vehicle_id: vehicle.vehicle_id } });
  await Incident.updateMany({ booking_id: id, incident_status: 'open' }, { $set: { incident_status: 'resolved', resolution_note: `Đã điều phối xe thay thế ${vehicle.plate_number}`, resolved_by: operatorId } });
  await audit(workflow, 'vehicle_replaced', operatorId, `Xe thay thế ${vehicle.plate_number}; chờ gara bàn giao`); await workflow.save();
  return workflow.toObject();
}
async function reassignReturn(bookingId, driverId, operatorId) {
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
  await audit(workflow, 'return_driver_reassigned', operatorId, `Tài xế lượt về: ${resources.user.full_name}`); await workflow.save();
  return workflow.toObject();
}
module.exports = { dispatchData, assign, mutateDriver, driverTrips, reportIncident, resolveIncident, replaceVehicle, reassignReturn };
