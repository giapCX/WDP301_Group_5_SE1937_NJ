import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ObjectId } from 'mongodb';
import { createOperationService } from '../src/modules/operation/operation.service.js';

const actorId = new ObjectId();
const request = { tokenPayload: { sub: actorId.toString() } };

test('booking decision changes only a pending booking and writes an audit record', async () => {
  const updates = [];
  const audits = [];
  const repository = {
    updateOne: async (...args) => { updates.push(args); return { modifiedCount: 1 }; },
    insertOne: async (...args) => { audits.push(args); },
  };
  const service = createOperationService(repository);
  const id = new ObjectId();
  const result = await service.decideBooking(request, id.toString(), { action: 'approve' });
  assert.equal(result.data.status, 'confirmed');
  assert.deepEqual(updates[0][1], { _id: id, status: 'pending' });
  assert.equal(audits[0][1].action, 'booking.approve');
});

test('booking rejection requires a reason and stale decisions return conflict', async () => {
  const service = createOperationService({ updateOne: async () => ({ modifiedCount: 0 }), insertOne: async () => {} });
  const id = new ObjectId().toString();
  await assert.rejects(service.decideBooking(request, id, { action: 'reject' }), { status: 400 });
  await assert.rejects(service.decideBooking(request, id, { action: 'approve' }), { status: 409 });
});

test('case workflow rejects invalid status transitions', async () => {
  const caseId = new ObjectId();
  const service = createOperationService({
    findById: async () => ({ _id: caseId, case_type: 'dispute', status: 'reported' }),
    updateOne: async () => ({ modifiedCount: 1 }),
    insertOne: async () => {},
  });
  await assert.rejects(service.updateCase(request, caseId.toString(), { status: 'closed' }, 'dispute'), { status: 403 });
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

test('Operation submits a compensation proposal for Manager review without deciding the claim', async () => {
  const caseId = new ObjectId();
  const updates = [];
  const service = createOperationService({
    findById: async () => ({
      _id: caseId,
      case_type: 'damage',
      status: 'in_progress',
      compensation_claims: [],
    }),
    updateOne: async (...args) => { updates.push(args); return { modifiedCount: 1 }; },
    insertOne: async () => {},
  });

  const result = await service.updateCase(request, caseId.toString(), {
    compensationProposal: {
      amount: 250000,
      responsibility: 'shared',
      note: 'Ảnh bàn giao và ảnh trả xe cho thấy hư hỏng mới phát sinh.',
    },
  });

  assert.equal(result.data.status, 'pending_manager');
  assert.equal(updates[0][2].$set.status, 'pending_manager');
  assert.equal(updates[0][2].$set['investigation.review_status'], 'pending_manager');
  assert.equal(updates[0][2].$push.compensation_claims.decision, 'pending');
  assert.equal(updates[0][2].$push.compensation_claims.proposed_amount, 250000);
});

test('Operation cannot resolve a dispute or close a case awaiting Manager decision', async () => {
  const caseId = new ObjectId();
  const service = createOperationService({
    findById: async () => ({
      _id: caseId,
      case_type: 'dispute',
      status: 'pending_manager',
      compensation_claims: [{ decision: 'pending' }],
    }),
    updateOne: async () => assert.fail('A case awaiting Manager review must not be changed'),
    insertOne: async () => {},
  });

  await assert.rejects(
    service.updateCase(request, caseId.toString(), { status: 'closed' }, 'dispute'),
    { status: 409 },
  );
});

test('Operation violation review submits a proposal and leaves the decision pending Manager', async () => {
  const caseId = new ObjectId();
  const updates = [];
  const service = createOperationService({
    findById: async () => ({
      _id: caseId,
      case_type: 'traffic_violation',
      status: 'investigating',
      traffic_violation_details: { fine_amount_claimed: 400000 },
    }),
    updateOne: async (...args) => { updates.push(args); return { modifiedCount: 1 }; },
    insertOne: async () => {},
  });

  const result = await service.proposeViolationReview(request, caseId.toString(), {
    decision: 'reject',
    note: 'Ảnh biển số không khớp với xe trong booking.',
  });

  assert.equal(result.data.status, 'pending_manager');
  assert.equal(updates[0][2].$set['traffic_violation_details.official_confirmation'], undefined);
  assert.equal(updates[0][2].$push.compensation_claims.proposed_amount, 0);
  assert.equal(updates[0][2].$push.compensation_claims.requested_amount, 400000);
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
