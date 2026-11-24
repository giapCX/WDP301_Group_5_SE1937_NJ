const {
  Booking, DriverProfile, MaintenanceRecord, TripWorkflow, Vehicle, VehicleHandover, VehicleInspection,
} = require('../models');
const HttpError = require('../utils/http-error');
const { positiveId } = require('../utils/numeric-id');
const damage = require('./garage-damage.service');
const maintenance = require('./garage-maintenance.service');

const HANDOVER_STAGES = ['awaiting_driver', 'awaiting_vehicle'];
const RETURN_STAGES = ['awaiting_vehicle_return', 'vehicle_return_issue'];
const TASK_STAGES = [...HANDOVER_STAGES, ...RETURN_STAGES, 'vehicle_replacement_required'];
const FAILED = ['fail', 'failed'];
const VEHICLE_FIELDS = 'vehicle_id plate_number brand model status -_id';
const INSPECTION_ORDER = { inspected_at: -1, inspection_id: -1 };

function dayStart(date) {
  if (date == null || date === '') return null;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'Ngày lọc không hợp lệ');
  }
  const midnight = new Date(date + 'T00:00:00Z');
  if (!Number.isFinite(+midnight) || midnight.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, 'Ngày lọc không hợp lệ');
  }
  return new Date(date + 'T00:00:00+07:00');
}

const indexBy = (records, field) => new Map(records.map((record) => [record[field], record]));
const inspectionKey = (bookingId, vehicleId, type) => [bookingId, vehicleId, type].join(':');

function currentInspection(workflow, type, inspectionsById, latestInspections) {
  const id = workflow[type + '_inspection_id'];
  const key = inspectionKey(workflow.booking_id, workflow.vehicle_id, type);
  if (id === undefined) return latestInspections.get(key);
  const inspection = inspectionsById.get(id);
  if (inspection && inspectionKey(inspection.booking_id, inspection.vehicle_id, inspection.inspection_type) === key) {
    return inspection;
  }
}

async function tripTasks(workflows) {
  if (!workflows.length) return [];
  const bookingIds = workflows.map((workflow) => workflow.booking_id);
  const [inspections, handovers, vehicles, bookings, drivers] = await Promise.all([
    VehicleInspection.find({ booking_id: { $in: bookingIds }, inspection_type: { $in: ['handover', 'return'] } })
      .sort(INSPECTION_ORDER).lean(),
    VehicleHandover.find({ booking_id: { $in: bookingIds } }).lean(),
    Vehicle.find({ vehicle_id: { $in: workflows.map((item) => item.vehicle_id) } }).select(VEHICLE_FIELDS).lean(),
    Booking.find({ booking_id: { $in: bookingIds } })
      .select('booking_id pickup_location dropoff_location pickup_time estimated_end_time -_id').lean(),
    DriverProfile.find({ driver_id: { $in: workflows.map((item) => item.driver_id) } })
      .populate({ path: 'user', select: 'full_name phone -_id' }).lean(),
  ]);
  const inspectionsById = indexBy(inspections, 'inspection_id');
  const handoversById = indexBy(handovers, 'inspection_id');
  const vehiclesById = indexBy(vehicles, 'vehicle_id');
  const bookingsById = indexBy(bookings, 'booking_id');
  const driversById = indexBy(drivers, 'driver_id');
  const latestInspections = new Map();
  for (const report of inspections) {
    const key = inspectionKey(report.booking_id, report.vehicle_id, report.inspection_type);
    if (!latestInspections.has(key)) latestInspections.set(key, report);
  }

  return workflows.flatMap((workflow) => {
    const { booking_id, vehicle_id, stage } = workflow;
    const booking = bookingsById.get(booking_id);
    const returning = RETURN_STAGES.includes(stage);
    const type = returning ? 'return' : 'handover';
    const inspection = stage === 'awaiting_driver'
      ? undefined : currentInspection(workflow, type, inspectionsById, latestInspections);
    const failed = FAILED.includes(inspection?.result);
    if (!returning && !HANDOVER_STAGES.includes(stage) && !failed) return [];

    return [{
      id: `${type}-${booking_id}`, booking_id, vehicle_id, inspection,
      type: returning ? 'RETURN_IN' : 'HANDOVER_OUT',
      inspection_type: type,
      status: failed ? 'failed' : inspection ? 'in_progress' : 'pending',
      handover: returning ? undefined : handoversById.get(inspection?.inspection_id),
      vehicle: vehiclesById.get(vehicle_id),
      driver: driversById.get(workflow.driver_id)?.user || null,
      booking,
      due_at: returning ? workflow.ended_at : booking?.pickup_time,
      workflow_stage: stage,
      note: inspection?.condition_note || null,
    }];
  });
}

async function maintenanceTasks() {
  const records = await MaintenanceRecord.find(maintenance.openMaintenance())
    .sort({ started_at: 1, maintenance_id: 1 }).populate('vehicle', VEHICLE_FIELDS).lean();
  return records.map(({ vehicle, ...record }) => ({
    id: `maintenance-${record.maintenance_id}`, vehicle_id: record.vehicle_id, vehicle,
    type: 'MAINTENANCE',
    status: ['in_progress', 'awaiting_approval'].includes(record.maintenance_status) ? record.maintenance_status : 'pending',
    maintenance: record, driver: null, due_at: record.started_at, workflow_stage: null, note: record.description,
  }));
}

async function tasks({ date } = {}) {
  const start = dayStart(date);
  const end = start && new Date(+start + 24 * 60 * 60 * 1000);
  const workflows = TripWorkflow.find({ stage: { $in: TASK_STAGES } }).sort({ updated_at: -1 }).lean();
  const [trips, records] = await Promise.all([workflows.then(tripTasks), maintenanceTasks()]);
  const scheduled = start ? trips.filter((task) => !task.due_at || (task.due_at >= start && task.due_at < end)) : trips;
  return [...scheduled, ...records];
}

function findTripInspection(booking_id, vehicle_id, type, inspectionId, session = null) {
  if (inspectionId === null) return null;
  return VehicleInspection.findOne({
    booking_id, vehicle_id, inspection_type: type,
    ...(inspectionId !== undefined && { inspection_id: inspectionId }),
    ...(type === 'handover' && { result: { $in: ['passed', 'pass'] } }),
  }).sort(INSPECTION_ORDER).session(session).lean();
}

async function returnDetails(taskId, booking_id, vehicle_id, workflow, active) {
  const inspection = active ? active.inspection
    : await findTripInspection(booking_id, vehicle_id, 'return', workflow?.return_inspection_id);
  if (!active && !inspection) return null;
  const beforeId = inspection?.before_inspection_id === undefined
    ? workflow?.handover_inspection_id : inspection.before_inspection_id;
  const [before_inspection, damage_report, vehicle] = await Promise.all([
    findTripInspection(booking_id, vehicle_id, 'handover', beforeId),
    FAILED.includes(inspection?.result) ? damage.findForInspection(inspection.inspection_id) : null,
    active ? active.vehicle : Vehicle.findOne({ vehicle_id }).select(VEHICLE_FIELDS).lean(),
  ]);
  return {
    ...(active || { id: taskId, booking_id, vehicle_id, type: 'RETURN_IN', status: 'completed', archived: true }),
    vehicle, inspection, before_inspection, damage_report,
    reported_odometer: workflow?.end_odometer,
    confirmed_at: workflow?.vehicle_returned_at,
  };
}

async function taskDetails(taskId, vehicleId) {
  const vehicle_id = positiveId(vehicleId, 'Mã xe');
  const match = /^(handover|return|maintenance)-(\d+)$/.exec(taskId);
  if (!match) return null;
  const [, type, id] = match;
  const recordId = positiveId(id, 'Mã nhiệm vụ');
  if (type === 'maintenance') return maintenance.taskDetails(recordId, vehicle_id);

  const booking_id = recordId;
  const workflow = await TripWorkflow.findOne({ booking_id, vehicle_id }).lean();
  const [current] = await tripTasks(TASK_STAGES.includes(workflow?.stage) ? [workflow] : []);
  const active = current?.id === taskId ? current : null;
  if (type === 'return') return returnDetails(taskId, booking_id, vehicle_id, workflow, active);
  if (active) return active;

  const handover = await VehicleHandover.findOne({ booking_id, vehicle_id }).sort({ inspection_id: -1 }).lean();
  if (!handover) return null;
  const [inspection, vehicle] = await Promise.all([
    VehicleInspection.findOne({ booking_id, vehicle_id, inspection_type: 'handover', inspection_id: handover.inspection_id }).lean(),
    Vehicle.findOne({ vehicle_id }).select(VEHICLE_FIELDS).lean(),
  ]);
  return {
    id: taskId, booking_id, vehicle_id, type: 'HANDOVER_OUT', status: 'completed',
    archived: true, handover, inspection, vehicle,
  };
}

module.exports = { tasks, taskDetails, findTripInspection };
