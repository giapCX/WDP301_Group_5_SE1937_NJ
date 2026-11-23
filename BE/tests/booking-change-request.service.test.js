const { test } = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../src/repositories/booking-change-request.repository');
const service = require('../src/services/booking-change-request.service');

test('list applies defaults and converts HTTP filters to repository arguments', async (context) => {
  const result = { items: [], total: 0, total_pages: 0 };
  const find = context.mock.method(repository, 'findChangeRequests', async () => result);

  assert.equal(await service.getChangeRequests(), result);
  assert.deepEqual(find.mock.calls[0].arguments[0], {
    status: undefined,
    bookingId: undefined,
    page: 1,
    limit: 10,
  });

  await service.getChangeRequests({
    status: ' pending ',
    booking_id: '2',
    page: '3',
    limit: '5',
  });
  assert.deepEqual(find.mock.calls[1].arguments[0], {
    status: 'pending',
    bookingId: 2,
    page: 3,
    limit: 5,
  });
});

test('invalid filters return 400 without accessing the repository', async (context) => {
  const find = context.mock.method(repository, 'findChangeRequests', async () => ({}));
  const invalidQueries = [
    null,
    [],
    { page: 0 },
    { page: '2abc' },
    { page: '1e2' },
    { page: Number.MAX_SAFE_INTEGER, limit: 100 },
    { limit: 11 },
    { limit: '' },
    { limit: 1.5 },
    { status: '' },
    { status: 'confirmed' },
    { status: ['pending'] },
    { status: { $ne: '' } },
    { booking_id: null },
    { booking_id: true },
    { booking_id: ['2'] },
    { booking_id: -1 },
  ];

  for (const query of invalidQueries) {
    await assert.rejects(service.getChangeRequests(query), { statusCode: 400 });
  }

  assert.equal(find.mock.callCount(), 0);
});

test('detail converts numeric ID, returns data and distinguishes 400 from 404', async (context) => {
  const request = { change_request_id: 3, before: {}, after: {} };
  const find = context.mock.method(repository, 'findChangeRequestById', async (id) => {
    return id === 3 ? request : null;
  });

  assert.equal(await service.getChangeRequestById('3'), request);
  assert.deepEqual(find.mock.calls[0].arguments, [3]);
  await assert.rejects(service.getChangeRequestById(999), { statusCode: 404 });

  for (const id of [undefined, null, '', 'abc', '3.5', 0, {}, ['3']]) {
    await assert.rejects(service.getChangeRequestById(id), { statusCode: 400 });
  }

  assert.equal(find.mock.callCount(), 2);
});

test('unexpected database errors propagate unchanged for both read operations', async (context) => {
  const error = new Error('Database unavailable');

  for (const name of ['findChangeRequests', 'findChangeRequestById']) {
    context.mock.method(repository, name, async () => {
      throw error;
    });
  }

  await assert.rejects(service.getChangeRequests(), (failure) => failure === error);
  await assert.rejects(service.getChangeRequestById(3), (failure) => failure === error);
});
