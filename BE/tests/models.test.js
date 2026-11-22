const { test } = require('node:test');
const assert = require('node:assert/strict');
const models = require('../src/models');
const data = require('../src/config/sample-data');

test('all 17 models preserve every sample field and validate all 71 documents', async () => {
  assert.equal(Object.keys(models).length, 17);
  for (const Model of Object.values(models)) {
    const rows = data[Model.collection.name];
    assert.ok(rows, Model.modelName);
    for (const row of rows) {
      for (const key of Object.keys(row))
        assert.ok(Model.schema.path(key), `${Model.modelName}.${key}`);
      const document = new Model(row);
      await document.validate();
      for (const key of Object.keys(row))
        assert.deepEqual(document.toObject({ virtuals: false })[key], row[key]);
    }
  }
});

test('required values, string lengths and integer IDs are validated', async () => {
  await assert.rejects(new models.User({}).validate(), (error) =>
    Boolean(error.errors.email),
  );
  const role = new models.Role({ role_id: 1.5, role_name: 'x'.repeat(41) });
  await assert.rejects(role.validate(), (error) =>
    Boolean(error.errors.role_id && error.errors.role_name),
  );
});

test('booking defaults preserve numeric references and existing timestamps', () => {
  const booking = new models.Booking(data.bookings[0]);
  assert.equal(booking.vehicle_id, null);
  assert.equal(booking.reviewed_by, null);
  assert.equal(booking.reviewed_at, null);
  assert.equal(booking.rejection_reason, null);
  assert.equal(booking.schema.virtualpath('renter').options.foreignField, 'user_id');
  assert.equal(booking.schema.options.timestamps, false);
});

test('DBML primary, one-to-one and compound uniqueness is declared', () => {
  for (const Model of Object.values(models)) {
    const key = Object.keys(data[Model.collection.name][0])[0];
    assert.ok(
      Model.schema
        .indexes()
        .some(([fields, options]) => fields[key] === 1 && options.unique),
    );
  }
  assert.ok(
    models.TripStop.schema
      .indexes()
      .some(
        ([fields, options]) =>
          fields.booking_id === 1 && fields.stop_order === 1 && options.unique,
      ),
  );
  for (const [Model, field] of [
    [models.DriverProfile, 'user_id'],
    [models.Review, 'booking_id'],
  ]) {
    assert.ok(
      Model.schema
        .indexes()
        .some(([fields, options]) => fields[field] === 1 && options.unique),
    );
  }
});
