import { saveGarageTask } from './garageApi';

const report = { odometer: '100', fuel: '70', confirmed: true, exterior: 'good', interior: 'good', engine: 'good', tires: 'good', note: '', photos: [{ key: 'intakes/car.jpg' }], accessories: ['vehicle_key'] };
beforeEach(() => {
  global.fetch = jest.fn(async (_url, options) => ({ ok: true, json: async () => ({ data: { _id: 'record', version: options.method === 'PATCH' ? 3 : 4 } }) }));
});
afterEach(() => { delete global.fetch; });

test('intake update sends version, accessories and the separate owner confirmation required by the existing API', async () => {
  await saveGarageTask({ kind: 'intake', recordId: 'record', version: 2 }, report, false, jest.fn());
  const [patch, confirmation] = global.fetch.mock.calls;
  expect(patch[0]).toBe('/api/garage/intakes/record');
  expect(JSON.parse(patch[1].body)).toMatchObject({ version: 2, condition: { accessories: ['vehicle_key'], photoKeys: ['intakes/car.jpg'] } });
  expect(confirmation[0]).toBe('/api/garage/intakes/record/confirm');
  expect(JSON.parse(confirmation[1].body)).toEqual({ version: 3, ownerConfirmed: true });
});

test('return report uses the handover API and records the renter confirmation', async () => {
  await saveGarageTask({ kind: 'return', bookingId: 'booking' }, report, false, jest.fn());
  const [creation, confirmation] = global.fetch.mock.calls;
  expect(creation[0]).toBe('/api/garage/handovers');
  expect(JSON.parse(creation[1].body)).toMatchObject({ bookingId: 'booking', type: 'return' });
  expect(JSON.parse(creation[1].body).condition.accessories).toBeUndefined();
  expect(JSON.parse(confirmation[1].body)).toEqual({ version: 4, renterConfirmed: true });
});
