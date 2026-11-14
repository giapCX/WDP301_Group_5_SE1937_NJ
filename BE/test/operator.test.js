import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getModels } from '../src/models/index.js';
import { closeTestDatabase, connectTestDatabase } from '../test-support/seeded-database.js';

let models;
let server;
let base;
const tokens = {};
const actors = {};
const storedFiles = new Map();
const fileRepository = {
  async save(ownerId, input, purpose) {
    const key = `owner-files/${ownerId}/${purpose}/${randomUUID()}.pdf`;
    storedFiles.set(key, input.bytes);
    return key;
  },
  async read(key) {
    const bytes = storedFiles.get(key);
    if (!bytes) throw new Error('Missing fixture file');
    return bytes;
  },
  async remove(keys) {
    keys.forEach((key) => storedFiles.delete(key));
  },
};

before(async () => {
  const connection = await connectTestDatabase();
  models = getModels(connection);
  for (const [name, number] of Object.entries({ owner: 1, renter: 8, garage: 16, operation: 17, manager: 19 })) {
    const id = `02${number.toString(16).padStart(22, '0')}`;
    actors[name] = await models.User.findById(id).lean();
    tokens[name] = jwt.sign({ sub: id }, env.jwtSecret);
  }
  server = createApp(connection, { ownerFileRepository: fileRepository }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeTestDatabase();
});

async function request(path, method = 'GET', body, role = 'operation', expectedStatus = 200) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tokens[role]}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, expectedStatus, JSON.stringify(result));
  return { response, result };
}

test('Operator Staff reads contracts, updates vehicle status and schedules onboarding inspections', async () => {
  const vehicle = await models.Vehicle.create({
    owner_id: actors.owner._id,
    license_plate: `OP-${randomUUID()}`,
    brand: 'Toyota',
    model: 'Vios',
    physical_status: 'with_owner',
    onboarding_status: 'approved',
    documents: { registration: { file_key: 'fixture-registration' } },
    created_at: new Date(),
  });
  storedFiles.set('fixture-registration', Buffer.from('%PDF-1.4 vehicle record'));

  const vehicles = await request(`/operator/vehicles?page=1&limit=10&q=${encodeURIComponent(vehicle.license_plate)}`);
  assert.ok(vehicles.result.data.some((row) => row.id === vehicle._id.toString()));
  assert.equal(vehicles.result.pagination.page, 1);

  const dashboard = await request('/operator/dashboard');
  assert.deepEqual(Object.keys(dashboard.result.data.metrics).sort(), [
    'activeVehicles',
    'expiringContracts',
    'identityVerificationsPending',
    'incidentsInProgress',
    'incidentsNeedsOperatorAction',
    'incidentsWaitingManager',
    'inspectionScheduleRequestsWaiting',
    'inspectionsAwaitingManager',
    'inspectionsOverdue',
    'inspectionsUpcoming',
    'vehiclesAwaitingInspection',
  ]);
  const vehicleDetails = await request(`/operator/vehicles/${vehicle._id}`);
  assert.equal(vehicleDetails.result.data.licensePlate, vehicle.license_plate);
  const document = await request(`/operator/vehicles/${vehicle._id}/documents/registration`);
  assert.equal(document.response.headers.get('content-type'), 'application/pdf');
  assert.equal(document.result.toString('ascii', 0, 5), '%PDF-');

  await request(`/operator/vehicles/${vehicle._id}/status`, 'PATCH', {
    status: 'maintenance',
    note: 'Đưa xe đi bảo dưỡng.',
  });

  await request(`/operator/vehicles/${vehicle._id}/status`, 'PATCH', {
    status: 'rented',
    note: 'Không được bỏ qua bàn giao booking.',
  }, 'operation', 409);
  await request(`/operator/vehicles/${vehicle._id}/status`, 'PATCH', {
    status: 'at_garage',
  }, 'operation', 400);
  await request(`/operator/vehicles/${vehicle._id}/status`, 'PATCH', {
    status: 'at_garage',
    note: 'Xe đã hoàn tất bảo dưỡng.',
  });
  await request(`/operator/vehicles/${vehicle._id}/status`, 'PATCH', {
    status: 'rented',
    onboardingStatus: 'approved',
  }, 'operation', 400);
  const updatedVehicle = await models.Vehicle.findById(vehicle._id).lean();
  assert.equal(updatedVehicle.physical_status, 'at_garage');
  assert.equal(updatedVehicle.onboarding_status, 'approved');
  assert.equal(updatedVehicle.operational_status_history.length, 2);
  assert.equal(updatedVehicle.operational_status_history[0].note, 'Đưa xe đi bảo dưỡng.');

  const contracts = await request('/contracts/rental?view=staff');
  assert.ok(Array.isArray(contracts.result.data));
  await request('/contracts/rental/prepare/000000000000000000000001', 'POST', {}, 'operation', 403);
  await request('/operation/dashboard', 'GET', undefined, 'operation', 404);
  await request('/manager/bookings', 'GET', undefined, 'operation', 403);
  await request('/manager/listings', 'GET', undefined, 'operation', 403);
  await request('/manager/bookings', 'GET', undefined, 'manager');
  await request('/manager/listings', 'GET', undefined, 'manager');
  await request('/operator/dashboard', 'GET', undefined, 'renter', 403);
});

test('inspection workflow lists Owner requests and Garage reports for Operator review', async () => {
  const requestedVehicle = await models.Vehicle.create({
    owner_id: actors.owner._id,
    license_plate: `OP-REQUEST-${randomUUID()}`,
    brand: 'Toyota',
    model: 'Request queue',
    physical_status: 'with_owner',
    onboarding_status: 'submitted',
    inspection_schedule_request: {
      status: 'pending',
      requested_for: new Date(Date.now() + 3600000),
      note: 'Chủ xe đề xuất kiểm tra tại gara.',
    },
    created_at: new Date(),
  });
  const reportVehicle = await models.Vehicle.create({
    owner_id: actors.owner._id,
    license_plate: `OP-REPORT-${randomUUID()}`,
    brand: 'Honda',
    model: 'Report queue',
    physical_status: 'with_owner',
    onboarding_status: 'submitted',
    created_at: new Date(),
  });
  const report = await models.VehicleInspection.create({
    vehicle_id: reportVehicle._id,
    garage_staff_id: actors.garage._id,
    inspection_type: 'onboarding',
    approval_status: 'pending',
    recommendation: 'pass',
    version: 2,
    condition_report: {
      odometer_km: 12500,
      fuel_level_pct: 70,
      checklist: [{ key: 'identity', result: 'pass', note: 'Đã đối chiếu giấy tờ Chủ xe.' }],
      photo_keys: [],
    },
    owner_review: { status: 'accepted', owner_id: actors.owner._id },
    submitted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  const queue = await request('/operator/inspection-workflow?page=1&limit=10');
  assert.ok(queue.result.data.scheduleRequests.some((vehicle) => vehicle.id === requestedVehicle._id.toString()));
  const queuedReport = queue.result.data.garageReports.find((item) => item.id === report._id.toString());
  assert.equal(queuedReport.vehicle.licensePlate, reportVehicle.license_plate);
  assert.equal(queuedReport.conditionReport.checklist[0].key, 'identity');

  const detail = await request(`/operator/vehicles/${reportVehicle._id}`);
  assert.equal(detail.result.data.inspectionReport.conditionReport.odometer_km, 12500);
  assert.equal(detail.result.data.inspectionReport.ownerReview.status, 'accepted');
  await request(`/operator/inspections/${report._id}/precheck`, 'POST', { note: 'Đã đối chiếu biên bản Garage.' });
  const refreshed = await request('/operator/inspection-workflow?page=1&limit=10');
  assert.ok(!refreshed.result.data.garageReports.some((item) => item.id === report._id.toString()));
});

test('Operator schedules an onboarding inspection only for an eligible vehicle and Garage Staff', async () => {
  const vehicle = await models.Vehicle.create({
    owner_id: actors.owner._id,
    license_plate: `SCHEDULE-${randomUUID()}`,
    brand: 'Toyota',
    model: 'Corolla',
    physical_status: 'with_owner',
    onboarding_status: 'submitted',
    created_at: new Date(),
  });
  await request(`/owner/vehicles/${vehicle._id}/inspection-schedule-requests`, 'POST', {
    requestedFor: new Date(Date.now() + 3600000).toISOString(),
    note: 'Đề xuất lịch kiểm định xe.',
  }, 'owner', 201);
  const staff = await request('/operator/vehicles/garage-staff');
  assert.ok(staff.result.data.some((item) => item.id === actors.garage._id.toString()));

  const assignment = {
    garageStaffId: actors.garage._id.toString(),
    scheduledFor: new Date(Date.now() + 3600000).toISOString(),
    note: 'Kiểm định đầu vào tại gara.',
  };
  const { result } = await request(`/operator/vehicles/${vehicle._id}/inspection-schedule`, 'POST', assignment, 'operation', 201);
  let inspection = await models.VehicleInspection.findById(result.data.id).lean();
  assert.equal(inspection.approval_status, 'draft');
  assert.equal(String(inspection.garage_staff_id), actors.garage._id.toString());
  assert.equal(String(inspection.assigned_by_operator_staff_id), actors.operation._id.toString());
  const secondGarageStaff = await models.User.create({
    full_name: 'Garage Staff Backup',
    email: `garage-${randomUUID()}@example.com`,
    primary_role_id: actors.garage.primary_role_id,
    account_status: 'active',
  });
  const nextDate = new Date(Date.now() + 2 * 3600000);
  const updated = await request(`/operator/vehicles/${vehicle._id}/inspection-schedule`, 'PATCH', {
    garageStaffId: secondGarageStaff._id.toString(),
    scheduledFor: nextDate.toISOString(),
    note: 'Đổi lịch theo xác nhận của gara.',
    version: 0,
  }, 'operation');
  assert.equal(updated.result.data.version, 1);
  inspection = await models.VehicleInspection.findById(result.data.id).lean();
  assert.equal(String(inspection.garage_staff_id), secondGarageStaff._id.toString());
  assert.equal(inspection.version, 1);
  const vehicleDetails = await request(`/operator/vehicles/${vehicle._id}`);
  assert.equal(vehicleDetails.result.data.inspection.scheduleState, 'upcoming');
  assert.equal(vehicleDetails.result.data.inspection.garageStaff.full_name, 'Garage Staff Backup');
  assert.equal(await models.AuditLog.countDocuments({
    action: 'vehicle.inspection.reschedule',
    entity_id: inspection._id,
  }), 1);
  await request(`/operator/vehicles/${vehicle._id}/inspection-schedule`, 'PATCH', {
    garageStaffId: actors.garage._id.toString(),
    scheduledFor: new Date(Date.now() + 3 * 3600000).toISOString(),
    note: 'Thử cập nhật bằng version cũ.',
    version: 0,
  }, 'operation', 409);
  await models.VehicleInspection.updateOne({ _id: inspection._id }, { $set: { approval_status: 'pending' } });
  await request(`/operator/vehicles/${vehicle._id}/inspection-schedule`, 'PATCH', {
    garageStaffId: actors.garage._id.toString(),
    scheduledFor: new Date(Date.now() + 3 * 3600000).toISOString(),
    note: 'Không đổi lịch sau khi Garage gửi.',
    version: 1,
  }, 'operation', 409);
  await request(`/operator/vehicles/${vehicle._id}/inspection-schedule`, 'POST', assignment, 'operation', 409);
  await request(`/operator/vehicles/${vehicle._id}/inspection-schedule`, 'POST', assignment, 'renter', 403);
});

test('Operator can only schedule inspection for active Garage Staff with inspection permission', async () => {
  const vehicle = await models.Vehicle.create({
    owner_id: actors.owner._id,
    license_plate: `SCHEDULE-ROLE-${randomUUID()}`,
    physical_status: 'with_owner',
    onboarding_status: 'revision_required',
    created_at: new Date(),
  });
  await request(`/owner/vehicles/${vehicle._id}/inspection-schedule-requests`, 'POST', {
    requestedFor: new Date(Date.now() + 3600000).toISOString(),
    note: 'Đề xuất lịch kiểm định xe.',
  }, 'owner', 201);
  const inactive = await models.User.create({
    full_name: 'Inactive Garage',
    email: `inactive-garage-${randomUUID()}@example.com`,
    primary_role_id: actors.garage.primary_role_id,
    account_status: 'inactive',
  });
  const assignment = {
    garageStaffId: inactive._id.toString(),
    scheduledFor: new Date(Date.now() + 3600000).toISOString(),
    note: 'Kiểm tra trạng thái tài khoản.',
  };
  await request(`/operator/vehicles/${vehicle._id}/inspection-schedule`, 'POST', assignment, 'operation', 404);
});

test('concurrent vehicle status updates do not duplicate history or audit entries', async () => {
  const vehicle = await models.Vehicle.create({
    owner_id: actors.owner._id,
    license_plate: `STATUS-RACE-${randomUUID()}`,
    physical_status: 'with_owner',
    onboarding_status: 'approved',
    created_at: new Date(),
  });
  const results = await Promise.all([
    request(`/operator/vehicles/${vehicle._id}/status`, 'PATCH', {
      status: 'maintenance',
      note: 'Bảo dưỡng theo yêu cầu gara.',
    }),
    request(`/operator/vehicles/${vehicle._id}/status`, 'PATCH', {
      status: 'maintenance',
      note: 'Xác nhận xe cần bảo dưỡng.',
    }),
  ]);
  assert.ok(results.every((result) => result.result.data.physicalStatus === 'maintenance'));
  const updated = await models.Vehicle.findById(vehicle._id).lean();
  assert.equal(updated.operational_status_history.length, 1);
  assert.equal(await models.AuditLog.countDocuments({
    action: 'vehicle.operational_status.update',
    entity_id: vehicle._id,
  }), 1);
});

test('Operator Staff records and submits evidence for Manager review without deciding the outcome', async () => {
  const vehicle = await models.Vehicle.create({
    owner_id: actors.owner._id,
    license_plate: `CASE-${randomUUID()}`,
    brand: 'Honda',
    model: 'City',
    physical_status: 'rented',
    onboarding_status: 'approved',
    created_at: new Date(),
  });
  const { result: created } = await request('/operator/incidents', 'POST', {
    vehicleId: vehicle._id.toString(),
    caseType: 'traffic_violation',
    vehicleSeized: false,
    description: 'Ghi nhận thông báo vi phạm để Manager xem xét.',
  }, 'operation', 201);
  assert.equal(created.data.status, 'reported');
  await request(`/operator/incidents/${created.data.id}`, 'PATCH', {
    status: 'resolved',
  }, 'operation', 400);

  const pdf = Buffer.from('%PDF-1.4 operator evidence');
  await request(`/operator/incidents/${created.data.id}/evidence`, 'POST', {
    file: {
      name: 'bien-ban.pdf',
      contentType: 'application/pdf',
      data: `data:application/pdf;base64,${pdf.toString('base64')}`,
    },
  }, 'operation', 201);
  await request(`/operator/incidents/${created.data.id}`, 'PATCH', {
    resolution: { outcome: 'confirmed' },
  }, 'operation', 400);
  await request(`/operator/incidents/${created.data.id}/submit`, 'POST', {});

  const managerList = await request('/manager/incidents?status=all', 'GET', undefined, 'manager');
  const managerCase = managerList.result.data.find((item) => item.id === created.data.id);
  assert.ok(managerCase);
  assert.equal(managerCase.status, 'pending_manager');
  assert.equal(managerCase.trafficViolation.official_confirmation, 'pending_manager_review');

  const evidence = await request(`/operator/incidents/${created.data.id}/evidence/0`, 'GET', undefined, 'manager');
  assert.equal(evidence.result.toString(), pdf.toString());
  await request(`/operator/incidents/${created.data.id}`, 'PATCH', {
    description: 'Sửa sau khi chuyển Manager.',
  }, 'operation', 403);
  await request(`/operator/incidents/${created.data.id}/evidence/0`, 'GET', undefined, 'renter', 403);

  await request(`/manager/incidents/${created.data.id}/violation`, 'PATCH', {
    decision: 'approve',
    amount: 0,
    note: 'Manager đã xem xét hồ sơ.',
  }, 'manager');
  const resolved = await models.IncidentCase.findById(created.data.id).lean();
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.traffic_violation_details.official_confirmation, 'confirmed');
});

test('Manager can request incident details and Operator can update and resubmit only that case', async () => {
  const vehicle = await models.Vehicle.create({
    owner_id: actors.owner._id,
    license_plate: `INFO-${randomUUID()}`,
    physical_status: 'rented',
    onboarding_status: 'approved',
    created_at: new Date(),
  });
  const booking = await models.Booking.create({
    booking_code: `BOOK-${randomUUID()}`,
    vehicle_id: vehicle._id,
    renter_id: actors.renter._id,
    start_at: new Date(Date.now() - 86400000),
    end_at: new Date(),
    status: 'completed',
  });
  const { result: created } = await request('/operator/incidents', 'POST', {
    vehicleId: vehicle._id.toString(),
    bookingId: booking._id.toString(),
    caseType: 'vehicle_damage',
    vehicleSeized: false,
    incidentType: 'Trầy xước thân xe',
    severity: 'medium',
    location: { latitude: 10.77, longitude: 106.69 },
    odometerKm: 12500,
    description: 'Ghi nhận hư hỏng trong chuyến thuê.',
  }, 'operation', 201);
  let incident = await models.IncidentCase.findById(created.data.id).lean();
  assert.equal(String(incident.booking_id), booking._id.toString());
  assert.equal(incident.incident_type, 'Trầy xước thân xe');
  assert.equal(incident.location.latitude, 10.77);
  assert.equal(incident.odometer_km, 12500);

  await request(`/operator/incidents/${created.data.id}/submit`, 'POST', {});
  await request(`/operator/incidents/${created.data.id}`, 'PATCH', {
    description: 'Không thể cập nhật khi Manager đang xử lý.',
  }, 'operation', 403);
  await request(`/manager/incidents/${created.data.id}/review`, 'PATCH', {
    action: 'request_information',
    note: 'Bổ sung ảnh vị trí hư hỏng.',
  }, 'manager');
  incident = await models.IncidentCase.findById(created.data.id).lean();
  assert.equal(incident.status, 'need_more_information');
  assert.equal(incident.investigation.review_status, 'needs_information');
  assert.equal(incident.operation_timeline.at(-1).note, 'Bổ sung ảnh vị trí hư hỏng.');
  const managerQueue = await request('/manager/incidents?status=all', 'GET', undefined, 'manager');
  assert.equal(managerQueue.result.data.find((item) => item.id === created.data.id).status, 'need_more_information');
  assert.equal(await models.AuditLog.countDocuments({
    action: 'incident.request_information',
    entity_id: incident._id,
  }), 1);
  const updatedBooking = await models.Booking.create({
    booking_code: `BOOK-${randomUUID()}`,
    vehicle_id: vehicle._id,
    renter_id: actors.renter._id,
    start_at: new Date(Date.now() - 172800000),
    end_at: new Date(Date.now() - 86400000),
    status: 'completed',
  });

  await request(`/operator/incidents/${created.data.id}`, 'PATCH', {
    bookingId: updatedBooking._id.toString(),
    description: 'Đã bổ sung mô tả và chứng cứ vị trí.',
    incidentType: 'Vết xước cửa bên trái',
    severity: 'high',
    vehicleSeized: true,
    note: 'Ảnh chụp sau khi nhận xe.',
  }, 'operation');
  await request(`/operator/incidents/${created.data.id}/submit`, 'POST', {});
  incident = await models.IncidentCase.findById(created.data.id).lean();
  assert.equal(incident.status, 'pending_manager');
  assert.equal(incident.description, 'Đã bổ sung mô tả và chứng cứ vị trí.');
  assert.equal(incident.severity, 'high');
  assert.equal(String(incident.booking_id), updatedBooking._id.toString());
  assert.equal(incident.operation_timeline.at(-1).action, 'incident.submitted_to_manager');

  await request(`/manager/incidents/${created.data.id}/review`, 'PATCH', {
    action: 'request_information',
    note: 'Yêu cầu bổ sung vòng tiếp theo.',
  }, 'manager');
  incident = await models.IncidentCase.findById(created.data.id).lean();
  assert.equal(incident.status, 'need_more_information');
});

test('Operator incident filters accept historical statuses and reject unsupported file contents', async () => {
  const { result } = await request('/operator/incidents?status=resolved');
  assert.ok(Array.isArray(result.data));
  await request('/operator/incidents?status=not-a-status', 'GET', undefined, 'operation', 400);
  const vehicle = await models.Vehicle.create({
    owner_id: actors.owner._id,
    license_plate: `BAD-${randomUUID()}`,
    physical_status: 'with_owner',
    created_at: new Date(),
  });
  const { result: created } = await request('/operator/incidents', 'POST', {
    vehicleId: vehicle._id.toString(),
    caseType: 'other',
    description: 'Hồ sơ dùng để kiểm tra tệp không hợp lệ.',
  }, 'operation', 201);
  await request(`/operator/incidents/${created.data.id}/evidence`, 'POST', {
    file: {
      name: 'not-a-pdf.pdf',
      contentType: 'application/pdf',
      data: `data:application/pdf;base64,${Buffer.from('not a PDF').toString('base64')}`,
    },
  }, 'operation', 400);
});

test('Operator permission checks combine permissions from all assigned roles', async () => {
  const manager = await models.User.findById(actors.manager._id).lean();
  const operationRole = await models.Role.findOne({ code: 'OPERATION_STAFF' }).lean();
  await models.User.updateOne({ _id: manager._id }, {
    $set: { additional_role_ids: [...(manager.additional_role_ids || []), operationRole._id] },
  });
  try {
    await request('/operator/dashboard', 'GET', undefined, 'manager');
  } finally {
    await models.User.updateOne({ _id: manager._id }, {
      $set: { additional_role_ids: manager.additional_role_ids || [] },
    });
  }
});

test('Operator dashboard omits metrics the account cannot read', async () => {
  const manager = await models.User.findById(actors.manager._id).lean();
  const dashboardRole = await models.Role.create({
    code: `DASHBOARD_TEST_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
    display_name: 'Dashboard read test',
    permissions: ['operation.dashboard.read'],
  });
  await models.User.updateOne({ _id: manager._id }, {
    $set: { additional_role_ids: [...(manager.additional_role_ids || []), dashboardRole._id] },
  });
  try {
    const { result } = await request('/operator/dashboard', 'GET', undefined, 'manager');
    assert.deepEqual(result.data.metrics, {});
  } finally {
    await models.User.updateOne({ _id: manager._id }, {
      $set: { additional_role_ids: manager.additional_role_ids || [] },
    });
    await models.Role.deleteOne({ _id: dashboardRole._id });
  }
});
