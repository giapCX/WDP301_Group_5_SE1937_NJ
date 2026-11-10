import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { getModels, modelDefinitions } from '../src/models/index.js';

test('all registered models validate the existing seed dataset and preserve BSON values', async () => {
  const models = getModels(mongoose.createConnection());
  assert.equal(Object.keys(models).length, Object.keys(modelDefinitions).length);
  for (const [name, { collection }] of Object.entries(modelDefinitions)) {
    const content = await readFile(new URL(`../data/${collection}.json`, import.meta.url), 'utf8');
    const documents = mongoose.mongo.BSON.EJSON.parse(content.replace(/^\uFEFF/, ''), { relaxed: true });
    assert.equal(models[name].collection.name, collection);
    for (const data of documents) {
      const document = new models[name](data);
      await document.validate();
      assert.deepEqual(document.toObject(), data, `${name}: seed document must not change`);
    }
  }
});

test('garage schemas allow partial drafts and historical intakes without a status', async () => {
  const { VehicleInspection, VehicleIntake } = getModels(mongoose.createConnection());
  const vehicle_id = new mongoose.Types.ObjectId();
  const garage_staff_id = new mongoose.Types.ObjectId();
  await new VehicleInspection({ vehicle_id, garage_staff_id, inspection_type: 'onboarding', approval_status: 'draft' }).validate();
  const intake = new VehicleIntake({ vehicle_id, management_agreement_id: new mongoose.Types.ObjectId() });
  await intake.validate();
  assert.equal(intake.status, undefined);
  assert.equal(intake.version, undefined);
});

test('schemas reject unknown fields, invalid references, enums and numeric ranges', async () => {
  const { VehicleIntake, VehicleInspection } = getModels(mongoose.createConnection());
  const vehicle_id = new mongoose.Types.ObjectId();
  assert.throws(() => new VehicleIntake({ vehicle_id, unexpected: true }), /strict mode/);
  await assert.rejects(new VehicleIntake({ vehicle_id: 'invalid', fuel_level_pct: 101 }).validate(), { name: 'ValidationError' });
  await assert.rejects(new VehicleInspection({
    vehicle_id, garage_staff_id: new mongoose.Types.ObjectId(), inspection_type: 'onboarding',
    approval_status: 'invalid', condition_report: { odometer_km: -1 },
  }).validate(), { name: 'ValidationError' });
});
