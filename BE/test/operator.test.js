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
    'incidentsInProgress',
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
    onboardingStatus: 'approved',
  }, 'operation', 400);
  const updatedVehicle = await models.Vehicle.findById(vehicle._id).lean();
  assert.equal(updatedVehicle.physical_status, 'maintenance');
  assert.equal(updatedVehicle.onboarding_status, 'approved');
  assert.equal(updatedVehicle.operational_status_history.length, 1);

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
  const staff = await request('/operator/vehicles/garage-staff');
  assert.ok(staff.result.data.some((item) => item.id === actors.garage._id.toString()));

  const assignment = {
    garageStaffId: actors.garage._id.toString(),
    scheduledFor: new Date(Date.now() + 3600000).toISOString(),
    note: 'Kiểm định đầu vào tại gara.',
  };
  const { result } = await request(`/operator/vehicles/${vehicle._id}/inspection-schedule`, 'POST', assignment, 'operation', 201);
  const inspection = await models.VehicleInspection.findById(result.data.id).lean();
  assert.equal(inspection.approval_status, 'draft');
  assert.equal(String(inspection.garage_staff_id), actors.garage._id.toString());
  assert.equal(String(inspection.assigned_by_operator_staff_id), actors.operation._id.toString());
  await request(`/operator/vehicles/${vehicle._id}/inspection-schedule`, 'POST', assignment, 'operation', 409);
  await request(`/operator/vehicles/${vehicle._id}/inspection-schedule`, 'POST', assignment, 'renter', 403);
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
    description: 'Ghi nhận thông báo vi phạm để Manager xem xét.',
  }, 'operation', 201);
  assert.equal(created.data.status, 'reported');

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
