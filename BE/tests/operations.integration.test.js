const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const models = require('../src/models');
const sample = require('../src/config/sample-data');
const routes = require('../src/routes/operations.routes');
const charges = require('../src/routes/additional-charge.routes');
const changes = require('../src/routes/booking-change-request.routes');
const renterChanges = require('../src/routes/renter-booking-change.routes');
const errors = require('../middlewares/error.middleware');

test('workflow 4 owns cancellation, refund, incident approvals, disputes and itinerary pricing', async (context) => {
  const dbName = 'operations_test_' + process.pid + '_' + Date.now();
  await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27018/?replicaSet=rentalLocal', { dbName, serverSelectionTimeoutMS: 5000 });
  let server;
  context.after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  for (const Model of Object.values(models)) await Model.createCollection();
  await models.Booking.createIndexes(); await models.Payment.createIndexes(); await models.Refund.createIndexes();
  await models.User.insertMany(sample.users); await models.Role.insertMany(sample.roles); await models.Vehicle.insertMany(sample.vehicles); await models.DriverProfile.insertMany(sample.driver_profiles);
  const actors = { renter: { user_id: 7, role_id: 6, role_name: 'renter', status: 'active' }, other: { user_id: 8, role_id: 6, role_name: 'renter', status: 'active' },
    operator: { user_id: 3, role_id: 3, role_name: 'operator', status: 'active' }, manager: { user_id: 2, role_id: 2, role_name: 'manager', status: 'active' }, driver: { user_id: 5, role_id: 5, role_name: 'driver', status: 'active' } };
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = actors[req.get('test-actor')]; next(); });
  app.use('/operator/operations', routes.operator); app.use('/manager/operation-approvals', routes.manager); app.use('/renter/bookings', routes.renter);
  app.use('/operator/bookings', charges.operatorBookingRoutes); app.use('/renter/bookings', charges.renterBookingRoutes);
  app.use('/operator/booking-change-requests', changes); app.use('/renter/bookings', renterChanges); app.use(errors);
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function api(path, actor, body, method) {
    const response = await fetch(base + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', 'test-actor': actor || '' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  async function create(id, extra = {}) {
    return models.Booking.create({ ...sample.bookings[0], booking_id: id, renter_id: 7, vehicle_id: 2,
      pickup_time: new Date('2099-01-01T01:00:00Z'), estimated_end_time: new Date('2099-01-02T10:00:00Z'),
      booking_status: 'confirmed', requested_seat_count: 7, estimated_price: 1000000, additional_charge: 0,
      paid_total: 300000, pricing_breakdown: { subtotal: 1000000, surcharge: 0, discount: 0, total: 1000000 }, ...extra });
  }
  async function paid(id, amount = 300000) { return models.Payment.create({ payment_id: id, booking_id: id, amount, payment_method: 'simulation', payment_status: 'paid', purpose: 'deposit', paid_at: new Date() }); }
  await create(101); await paid(101);
  assert.equal((await api('/operator/operations/incidents')).status, 401);
  assert.equal((await api('/operator/operations/incidents', 'renter')).status, 403);
  assert.equal((await api('/manager/operation-approvals/refunds', 'operator')).status, 403);
  assert.equal((await api('/renter/bookings/101/operations', 'other')).status, 404);
  assert.equal((await api('/operator/operations/refunds?page=0', 'operator')).status, 400);
  assert.equal((await api('/renter/bookings/101/cancellation-preview', 'renter')).status, 409);
  await mongoose.connection.db.collection('service_policies').insertOne({ policy_id: 1, name: 'Demo cancellation 10%', cancellation_fee_percent: 10, status: 'active', updated_at: new Date() });
  const preview = await api('/renter/bookings/101/cancellation-preview', 'renter');
  assert.equal(preview.data.data.fee, 100000); assert.equal(preview.data.data.refund_amount, 200000);
  const requested = await api('/renter/bookings/101/cancellation', 'renter', { reason: 'Đổi kế hoạch' });
  assert.equal(requested.status, 200);
  const requestId = requested.data.data.id;
  assert.equal((await api('/renter/bookings/101/cancellation', 'renter', { reason: 'Lặp' })).status, 409);
  const decisions = await Promise.all([1, 2].map(() => api('/operator/operations/bookings/101/cancellation-decision', 'operator', { requestId, decision: 'approve', reason: 'Đủ điều kiện' })));
  assert.deepEqual(decisions.map((item) => item.status).sort(), [200, 409]);
  assert.equal((await models.Booking.findOne({ booking_id: 101 })).booking_status, 'cancelled');
  const refund = await models.Refund.findOne({ booking_id: 101 }).lean();
  assert.equal(refund.amount, 200000); assert.equal(await models.Refund.countDocuments({ booking_id: 101 }), 1);
  assert.equal((await api('/manager/operation-approvals/refunds/' + refund.refund_id + '/decision', 'manager', { decision: 'complete', reason: 'Test' })).status, 409);
  assert.equal((await api('/manager/operation-approvals/refunds/' + refund.refund_id + '/decision', 'manager', { decision: 'approve', reason: 'Duyệt hoàn' })).status, 200);
  assert.equal((await api('/manager/operation-approvals/refunds/' + refund.refund_id + '/decision', 'manager', { decision: 'complete', reason: 'Hoàn mô phỏng' })).status, 200);
  assert.equal((await models.Booking.findOne({ booking_id: 101 })).refunded_total, 200000);
  assert.equal((await api('/manager/operation-approvals/refunds/' + refund.refund_id + '/decision', 'manager', { decision: 'complete', reason: 'Lặp' })).status, 409);

  await create(102); await paid(102);
  const report = await api('/renter/bookings/102/incidents', 'renter', { description: 'Khiếu nại cần hỗ trợ', kind: 'complaint', evidence: ['https://example.com/proof.jpg'] });
  assert.equal(report.status, 200); const incidentId = report.data.data.incident_id;
  assert.equal((await api('/operator/operations/incidents/' + incidentId + '/resolve', 'operator', { reason: 'Tự đóng' })).status, 409);
  assert.equal((await api('/operator/operations/incidents/' + incidentId + '/proposal', 'operator', { action: 'compensation', amount: 100000, note: 'Hoàn hỗ trợ' })).status, 200);
  const proposal = (await models.Incident.findOne({ incident_id: incidentId })).resolution_approval;
  assert.equal((await api('/manager/operation-approvals/incidents/' + incidentId + '/decision', 'manager', { proposalId: 'old', decision: 'approve', reason: 'Test' })).status, 409);
  assert.equal((await api('/manager/operation-approvals/incidents/' + incidentId + '/decision', 'manager', { proposalId: proposal.id, decision: 'approve', reason: 'Đồng ý' })).status, 200);
  assert.equal((await api('/operator/operations/incidents/' + incidentId + '/resolve', 'operator', { reason: 'Đã hỗ trợ và lập hoàn tiền' })).status, 200);
  assert.equal(await models.Refund.countDocuments({ booking_id: 102 }), 1);
  assert.equal((await api('/renter/bookings/102/incidents', 'renter', { description: 'Test', kind: 'other', evidence: ['javascript:alert(1)'] })).status, 400);

  await create(103, { paid_total: 0 });
  const charge = await api('/operator/bookings/103/additional-charges', 'operator', { type: 'waiting', quantity: 2, unit_price: 100000, description: 'Chờ khách' });
  assert.equal(charge.status, 201); const chargeId = charge.data.data.charge.charge_id;
  assert.equal((await api('/operator/bookings/103/additional-charges/' + chargeId + '/confirm', 'operator', { reason: 'Đã kiểm tra' }, 'PATCH')).status, 200);
  assert.equal((await api('/renter/bookings/103/additional-charges/' + chargeId + '/dispute', 'renter', { reason: 'Không đồng ý' })).status, 200);
  assert.equal(require('../src/services/renter-payment.service').paymentDue((await models.Booking.findOne({ booking_id: 103 })).toObject()), null);
  assert.equal((await api('/operator/bookings/103/additional-charges/' + chargeId + '/resolve-dispute', 'operator', { reason: 'Miễn phí sau xem xét', resolution: 'waive' }, 'PATCH')).status, 200);
  assert.equal((await models.Booking.findOne({ booking_id: 103 })).additional_charge, 0);

  await create(104, { vehicle_id: 5, paid_total: 0, quote_offer: { accepted_at: new Date() }, service_type: 'roundtrip', requested_seats: 7,
    destination: 'Điểm du lịch', return_pickup_location: 'Điểm đón về', return_pickup_time: new Date('2099-01-02T05:00:00Z') });
  const changed = await api('/renter/bookings/104/change-requests', 'renter', { reason: 'Đổi điểm đón', after: { pickup_location: 'Điểm đón mới' } });
  assert.equal(changed.status, 201); const changeId = changed.data.data.change_request_id;
  const offered = await api('/operator/booking-change-requests/' + changeId + '/price', 'operator', { price: 1200000, reason: 'Điểm đón xa hơn' }, 'PATCH');
  assert.equal(offered.status, 200);
  assert.equal((await api('/operator/booking-change-requests/' + changeId + '/approve', 'operator', {}, 'PATCH')).status, 409);
  assert.equal((await api('/renter/bookings/change-requests/' + changeId + '/accept-price', 'other', { offerId: offered.data.data.price_offer.id })).status, 404);
  assert.equal((await api('/renter/bookings/change-requests/' + changeId + '/accept-price', 'renter', { offerId: offered.data.data.price_offer.id })).status, 200);
  assert.equal((await api('/operator/booking-change-requests/' + changeId + '/approve', 'operator', {}, 'PATCH')).status, 200);
  const updated = await models.Booking.findOne({ booking_id: 104 });
  assert.equal(updated.pickup_location, 'Điểm đón mới'); assert.equal(updated.pricing_breakdown.total, 1200000);
  assert.equal(+updated.return_pickup_time, +new Date('2099-01-02T05:00:00Z'));
  // A manager can waive a fee exceeding the deposit; an operator cannot override it.
  await create(105, { paid_total: 10000 }); await paid(105, 10000);
  const exceptional = await api('/renter/bookings/105/cancellation', 'renter', { reason: 'Cần xét ngoại lệ' });
  assert.equal(exceptional.status, 200);
  const exceptionBody = { requestId: exceptional.data.data.id, decision: 'approve', reason: 'Xét ngoại lệ', feeOverride: 5000 };
  assert.equal((await api('/operator/operations/bookings/105/cancellation-decision', 'operator', exceptionBody)).status, 403);
  assert.equal((await api('/manager/operation-approvals/bookings/105/cancellation-decision', 'manager', exceptionBody)).status, 200);
  assert.equal((await models.Booking.findOne({ booking_id: 105 })).cancellation.refund_amount, 5000);
  // Completed compensation must not become another customer charge.
  const compensation = await models.Refund.findOne({ booking_id: 102 });
  await api('/manager/operation-approvals/refunds/' + compensation.refund_id + '/decision', 'manager', { decision: 'approve', reason: 'Duyệt' });
  await api('/manager/operation-approvals/refunds/' + compensation.refund_id + '/decision', 'manager', { decision: 'complete', reason: 'Hoàn demo' });
  assert.equal((await models.Booking.findOne({ booking_id: 102 })).compensation_refunded, 100000);
  // Driver readiness is read from existing profiles and leave records.
  const readiness = require('../src/repositories/booking-readiness.repository');
  await models.DriverProfile.updateMany({}, { $set: { license_expiry: new Date('2100-01-01') } });
  assert.equal((await readiness.availableDrivers(updated)).length, 2);
  await mongoose.connection.db.collection('driver_unavailability').insertOne({ driver_id: 1, status: 'approved', start_at: new Date('2099-01-01'), end_at: new Date('2099-01-03') });
  assert.equal((await readiness.availableDrivers(updated)).length, 1);
  // A manager-approved driver replacement reuses dispatch validation and requires driver acceptance.
  const start = new Date(Date.now() - 2 * 3600000), end = new Date(Date.now() + 8 * 3600000);
  await create(106, { vehicle_id: 1, requested_seats: 5, requested_seat_count: 5, service_type: 'tour', booking_status: 'in_progress', pickup_time: start, estimated_end_time: end });
  await models.TripAssignment.create({ assignment_id: 1001, booking_id: 106, driver_id: 1, assigned_by: 3, assigned_at: new Date(), assignment_status: 'in_progress' });
  await models.TripWorkflow.create({ booking_id: 106, service_type: 'tour', driver_id: 1, vehicle_id: 1, stage: 'tour', driver_response: 'accepted', vehicle_received: true, created_at: new Date(), updated_at: new Date() });
  const incidentReport = await api('/renter/bookings/106/incidents', 'renter', { kind: 'other', description: 'Tài xế cần thay thế' });
  const replacementId = incidentReport.data.data.incident_id;
  await api('/operator/operations/incidents/' + replacementId + '/proposal', 'operator', { action: 'replace_driver', note: 'Đổi tài xế để hỗ trợ', amount: 0 });
  const replacementPlan = (await models.Incident.findOne({ incident_id: replacementId })).resolution_approval;
  assert.equal((await api('/manager/operation-approvals/incidents/' + replacementId + '/decision', 'manager', { proposalId: replacementPlan.id, decision: 'approve', reason: 'Đồng ý thay thế' })).status, 200);
  assert.equal((await api('/operator/operations/incidents/' + replacementId + '/replace-driver', 'operator', { driver_id: 2, reason: 'Tài xế mới còn lịch' })).status, 200);
  assert.equal((await api('/operator/operations/incidents/' + replacementId + '/resolve', 'operator', { reason: 'Đóng sớm' })).status, 409);
  const trip = require('../src/services/trip-workflow.service');
  await trip.mutateDriver(106, 6, 'accept', {});
  assert.equal((await models.TripWorkflow.findOne({ booking_id: 106 })).stage, 'tour');
  assert.equal((await api('/operator/operations/incidents/' + replacementId + '/resolve', 'operator', { reason: 'Tài xế mới đã nhận' })).status, 200);
  // In-progress changes preserve completed stops and resume the existing driver workflow.
  const at = (hours) => new Date(Date.now() + hours * 3600000);
  await models.TripStop.insertMany([
    { stop_id: 1001, booking_id: 106, stop_order: 1, location: 'Đã ghé', arrival_at: start, departure_at: new Date(+start + 3600000) },
    { stop_id: 1002, booking_id: 106, stop_order: 2, location: 'Điểm tiếp theo', arrival_at: at(1), departure_at: at(2) },
  ]);
  await models.TripWorkflow.updateOne({ booking_id: 106 }, { $set: { completed_stops: [1001] } });
  await trip.reportIncident(106, 6, { kind: 'customer_route_change', description: 'Khách yêu cầu đổi điểm còn lại' });
  const stops = await models.TripStop.find({ booking_id: 106 }).sort({ stop_order: 1 }).lean();
  const proposedStops = stops.map(({ stop_order, location, arrival_at, departure_at }) => ({ stop_order, location, arrival_at, departure_at }));
  assert.equal((await api('/renter/bookings/106/change-requests', 'renter', { reason: 'Sửa điểm đã đi', after: { trip_stops: proposedStops.map((item, index) => index ? item : { ...item, location: 'Sai' }) } })).status, 409);
  const activeChange = await api('/renter/bookings/106/change-requests', 'renter', { reason: 'Đổi điểm còn lại', after: { trip_stops: proposedStops.map((item, index) => index ? { ...item, location: 'Điểm mới' } : item) } });
  assert.equal(activeChange.status, 201);
  assert.equal((await api('/operator/booking-change-requests/' + activeChange.data.data.change_request_id + '/approve', 'operator', {}, 'PATCH')).status, 200);
  assert.equal((await models.TripWorkflow.findOne({ booking_id: 106 })).stage, 'tour');


});
