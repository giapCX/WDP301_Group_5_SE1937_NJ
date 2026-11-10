import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createOperationService } from '../src/modules/operation/operation.service.js';

const { ObjectId } = Types;
const actorId = new ObjectId();
const request = { tokenPayload: { sub: actorId.toString() } };

function bookingRepository(booking) {
  const updates = [];
  const audits = [];
  return {
    updates,
    audits,
    findById: async (_collection, id) => id.equals(booking._id) ? booking : null,
    updateMany: async (...args) => { updates.push(args); return { modifiedCount: 0 }; },
    updateOne: async (...args) => { updates.push(args); return { modifiedCount: 1 }; },
    insertOne: async (...args) => { audits.push(args); },
  };
}

test('booking approval enters awaiting_payment with a separate 15-minute deadline', async () => {
  const booking = {
    _id: new ObjectId(),
    status: 'pending',
    start_at: new Date(Date.now() + 3 * 60 * 60 * 1000),
  };
  const repository = bookingRepository(booking);
  const service = createOperationService(repository);
  const result = await service.decideBooking(request, booking._id.toString(), { action: 'approve' });
  assert.equal(result.data.status, 'awaiting_payment');
  assert.equal(result.data.decision, 'approved');
  assert.ok(result.data.paymentDeadline instanceof Date);
  assert.ok(result.data.paymentDeadline.getTime() - Date.now() <= 15 * 60 * 1000);
  assert.deepEqual(repository.updates[2][1], { _id: booking._id, status: 'pending' });
  assert.equal(repository.updates[2][2].$set.status, 'awaiting_payment');
  assert.equal(repository.audits[0][1].action, 'booking.approve');
});

test('booking approval refuses pickup less than two hours away', async () => {
  const booking = {
    _id: new ObjectId(),
    status: 'pending',
    start_at: new Date(Date.now() + 60 * 60 * 1000),
  };
  const service = createOperationService(bookingRepository(booking));
  await assert.rejects(service.decideBooking(request, booking._id.toString(), { action: 'approve' }), { status: 409 });
});

test('expired booking cleanup expires review and payment holds', async () => {
  const updates = [];
  const repository = {
    updateMany: async (...args) => { updates.push(args); return { modifiedCount: 1 }; },
    findMany: async () => [],
    count: async () => 0,
  };
  await createOperationService(repository).listBookings({});
  assert.equal(updates.length, 2);
  assert.equal(updates[0][1].status, 'pending');
  assert.equal(updates[1][1].status, 'awaiting_payment');
});

test('booking rejection requires a reason and stale decisions return conflict', async () => {
  const booking = { _id: new ObjectId(), status: 'rejected' };
  const service = createOperationService(bookingRepository(booking));
  await assert.rejects(service.decideBooking(request, booking._id.toString(), { action: 'reject' }), { status: 400 });
  await assert.rejects(service.decideBooking(request, booking._id.toString(), { action: 'approve' }), { status: 409 });
});

test('case workflow rejects invalid status transitions', async () => {
  const caseId = new ObjectId();
  const service = createOperationService({
    findById: async () => ({ _id: caseId, case_type: 'dispute', status: 'reported' }),
    updateOne: async () => ({ modifiedCount: 1 }),
    insertOne: async () => {},
  });
  await assert.rejects(service.updateCase(request, caseId.toString(), { status: 'closed' }, 'dispute'), { status: 409 });
  const resolvedService = createOperationService({
    findById: async () => ({ _id: caseId, case_type: 'dispute', status: 'under_review' }),
    updateOne: async () => ({ modifiedCount: 1 }),
    insertOne: async () => {},
  });
  await assert.rejects(resolvedService.updateCase(request, caseId.toString(), { status: 'resolved' }, 'dispute'), { status: 403 });
});

test('dispute can enter review from its initial state', async () => {
  const caseId = new ObjectId();
  const updates = [];
  const service = createOperationService({
    findById: async () => ({ _id: caseId, case_type: 'dispute', status: 'reported' }),
    updateOne: async (...args) => { updates.push(args); return { modifiedCount: 1 }; },
    insertOne: async () => {},
  });
  const result = await service.updateCase(request, caseId.toString(), { status: 'under_review' }, 'dispute');
  assert.equal(result.data.status, 'under_review');
  assert.equal(updates[0][2].$set.status, 'under_review');
});

test('Operation submits traffic violation recommendations for Manager decision', async () => {
  const caseId = new ObjectId();
  const updates = [];
  const service = createOperationService({
    findById: async () => ({ _id: caseId, case_type: 'traffic_violation', status: 'investigating' }),
    updateOne: async (...args) => { updates.push(args); return { modifiedCount: 1 }; },
    insertOne: async () => {},
  });
  const result = await service.reviewViolation(request, caseId.toString(), { decision: 'confirm', penaltyFee: 50000 });
  assert.equal(result.data.status, 'pending_manager');
  assert.equal(updates[0][2].$set['traffic_violation_details.operation_recommendation'], 'confirm');
  assert.equal(updates[0][2].$set['traffic_violation_details.operation_recommended_penalty_fee'], 50000);
});

test('Operation cannot change a case after it has been submitted to Manager', async () => {
  const caseId = new ObjectId();
  const service = createOperationService({
    findById: async () => ({ _id: caseId, case_type: 'dispute', status: 'pending_manager' }),
    updateOne: async () => ({ modifiedCount: 1 }),
    insertOne: async () => {},
  });
  await assert.rejects(
    service.updateCase(request, caseId.toString(), { status: 'awaiting_response' }, 'dispute'),
    { status: 403 },
  );
});

test('role guard permits operation staff and rejects other authenticated roles', async () => {
  const operationRole = new ObjectId();
  const renterRole = new ObjectId();
  const service = createOperationService({
    collection: () => ({
      find: ({ _id }) => ({ project: () => ({ toArray: async () => _id.$in.map((id) => ({
        _id: id, code: id.equals(operationRole) ? 'OPERATION_STAFF' : 'RENTER',
      })) }) }),
    }),
  });
  let allowedError = 'not-called';
  await service.authorizeOperationStaff({ user: { primary_role_id: operationRole } }, {}, (error) => { allowedError = error; });
  assert.equal(allowedError, undefined);

  let deniedError;
  await service.authorizeOperationStaff({ user: { primary_role_id: renterRole } }, {}, (error) => { deniedError = error; });
  assert.equal(deniedError.status, 403);
});
