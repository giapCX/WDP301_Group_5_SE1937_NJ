const { test } = require('node:test');
const assert = require('node:assert/strict');
const repository = require('../src/repositories/booking.repository');
const service = require('../src/services/booking.service');

test('list converts HTTP query values and applies pagination defaults', async (context) => {
  const expected = { items: [], total: 0 };
  const find = context.mock.method(repository, 'findBookings', async () => expected);

  assert.equal(await service.getBookings(), expected);
  assert.deepEqual(find.mock.calls[0].arguments[0], {
    status: undefined,
    page: 1,
    limit: 10,
  });

  await service.getBookings({ status: ' pending ', page: '2', limit: '5' });
  assert.deepEqual(find.mock.calls[1].arguments[0], {
    status: 'pending',
    page: 2,
    limit: 5,
  });
});

test('invalid filters fail with 400 before querying the database', async (context) => {
  const find = context.mock.method(repository, 'findBookings', async () => ({}));
  const invalidQueries = [
    null,
    [],
    { page: '2abc' },
    { page: '1e2' },
    { page: true },
    { page: [] },
    { page: 0 },
    { page: 1.5 },
    { page: Number.MAX_SAFE_INTEGER, limit: 100 },
    { limit: '' },
    { limit: 101 },
    { status: '' },
    { status: 'x'.repeat(31) },
    { status: ['pending'] },
    { status: { $ne: '' } },
  ];

  for (const query of invalidQueries) {
    await assert.rejects(service.getBookings(query), { statusCode: 400 });
  }

  assert.equal(find.mock.callCount(), 0);
});

test('detail uses numeric booking_id and returns 404 for missing booking', async (context) => {
  const booking = { booking_id: 2 };
  const find = context.mock.method(repository, 'findBookingById', async (id) => {
    return id === 2 ? booking : null;
  });

  assert.equal(await service.getBookingById('2'), booking);
  assert.deepEqual(find.mock.calls[0].arguments, [2]);
  await assert.rejects(service.getBookingById('999'), { statusCode: 404 });

  for (const id of [undefined, null, '', 'abc', '2.5', -1, {}, ['2']]) {
    await assert.rejects(service.getBookingById(id), { statusCode: 400 });
  }

  assert.equal(find.mock.callCount(), 2);
});

test('database errors propagate without becoming validation or not-found errors', async (context) => {
  const databaseError = new Error('Database unavailable');
  context.mock.method(repository, 'findBookingById', async () => {
    throw databaseError;
  });

  await assert.rejects(service.getBookingById(2), (error) => error === databaseError);
});
