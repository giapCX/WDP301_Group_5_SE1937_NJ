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

function mockReviewRepository(context, overrides = {}) {
  const pending = {
    booking_id: 1,
    vehicle_id: 2,
    booking_status: 'pending',
    pickup_time: new Date('2099-01-01T00:00:00Z'),
    estimated_end_time: new Date('2099-01-02T00:00:00Z'),
  };
  const defaults = {
    findBookingById: pending,
    findVehicleById: { vehicle_id: 2, status: 'available' },
    findOverlappingVehicleBooking: null,
    approvePendingBooking: { ...pending, booking_status: 'confirmed' },
    rejectPendingBooking: { ...pending, booking_status: 'rejected' },
  };
  const mocks = {};

  for (const [name, result] of Object.entries({ ...defaults, ...overrides })) {
    mocks[name] = context.mock.method(repository, name, async () => result);
  }

  return mocks;
}

test('approval selects a vehicle and uses the trusted reviewer argument', async (context) => {
  const mocks = mockReviewRepository(context);
  const result = await service.approveBooking(
    '1',
    {
      vehicle_id: '3',
      reviewed_by: 999,
    },
    3,
  );

  assert.equal(result.booking_status, 'confirmed');
  assert.deepEqual(mocks.approvePendingBooking.mock.calls[0].arguments[0], {
    bookingId: 1,
    vehicleId: 3,
    reviewedBy: 3,
  });
});

test('approval rejects missing, processed, unavailable and conflicting data', async (context) => {
  const cases = [
    [{ findBookingById: null }, 404],
    [{ findBookingById: { booking_status: 'confirmed' } }, 409],
    [{ findVehicleById: null }, 404],
    [{ findVehicleById: { status: 'maintenance' } }, 409],
    [{ findOverlappingVehicleBooking: { booking_id: 2 } }, 409],
    [
      {
        findBookingById: {
          booking_id: 1,
          vehicle_id: 2,
          booking_status: 'pending',
          pickup_time: null,
          estimated_end_time: new Date(),
        },
      },
      400,
    ],
  ];

  for (const [overrides, statusCode] of cases) {
    const mocks = mockReviewRepository(context, overrides);
    await assert.rejects(service.approveBooking(1, {}, 3), { statusCode });
    assert.equal(mocks.approvePendingBooking.mock.callCount(), 0);
    context.mock.restoreAll();
  }
});

test('approval validates reviewer, vehicle and request body', async (context) => {
  const mocks = mockReviewRepository(context);
  await assert.rejects(service.approveBooking(1, {}, undefined), { statusCode: 400 });
  await assert.rejects(service.approveBooking(1, null, 3), { statusCode: 400 });
  await assert.rejects(service.approveBooking(1, { vehicle_id: null }, 3), {
    statusCode: 400,
  });
  assert.equal(mocks.approvePendingBooking.mock.callCount(), 0);
});

test('rejection requires a reason and trims it before saving', async (context) => {
  const mocks = mockReviewRepository(context);
  for (const input of [null, {}, [], { rejection_reason: '  ' }]) {
    await assert.rejects(service.rejectBooking(1, input, 3), { statusCode: 400 });
  }
  assert.equal(mocks.rejectPendingBooking.mock.callCount(), 0);
  const result = await service.rejectBooking(
    '1',
    { rejection_reason: '  Khong du xe  ' },
    3,
  );
  assert.equal(result.booking_status, 'rejected');
  assert.deepEqual(mocks.rejectPendingBooking.mock.calls[0].arguments[0], {
    bookingId: 1,
    reviewedBy: 3,
    rejectionReason: 'Khong du xe',
  });
});

test('a competing decision returns 409 for both approval and rejection', async (context) => {
  mockReviewRepository(context, {
    approvePendingBooking: null,
    rejectPendingBooking: null,
  });
  await assert.rejects(service.approveBooking(1, {}, 3), { statusCode: 409 });
  await assert.rejects(service.rejectBooking(1, { rejection_reason: 'Khong du xe' }, 3), {
    statusCode: 409,
  });
});
