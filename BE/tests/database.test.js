import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { getModels } from '../src/models/index.js';
import { createModelRepository } from '../src/repositories/base.repository.js';
import { initializeCollections } from '../src/database/collections.js';
import { readSeedDatasets, seedDatabase } from '../src/database/seed.js';
import { connectTestDatabase, closeTestDatabase } from '../test-support/seeded-database.js';

let connection, models;
before(async () => {
  connection = await connectTestDatabase();
  models = getModels(connection);
});
after(closeTestDatabase);

test('setup preserves existing indexes and reseeding preserves changes to existing documents', async () => {
  await models.User.collection.createIndex({ full_name: 1 }, { name: 'custom_existing_index' });
  await initializeCollections(connection);
  assert.ok((await models.User.listIndexes()).some(({ name }) => name === 'custom_existing_index'));
  const user = await models.User.findOne().lean();
  await models.User.updateOne({ _id: user._id }, { $set: { full_name: 'Changed after seed' } });
  const results = await seedDatabase(connection, await readSeedDatasets());
  assert.equal(results.reduce((total, result) => total + result.inserted, 0), 0);
  assert.equal((await models.User.findById(user._id).lean()).full_name, 'Changed after seed');
});

test('repositories enforce schema validation on updates and retain the old value on failure', async () => {
  const user = await models.User.findOne().lean();
  const users = createModelRepository(models.User);
  await assert.rejects(async () => users.updateOne({ _id: user._id }, { $set: { account_status: 'invalid' } }), { name: 'ValidationError' });
  await assert.rejects(async () => users.findOneAndUpdate({ _id: user._id }, { $set: { unexpected: true } }), { name: 'StrictModeError' });
  assert.equal((await users.findOne({ _id: user._id })).account_status, user.account_status);
});
