import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { getModels, modelDefinitions } from '../models/index.js';
import { initializeCollections } from './collections.js';

export async function readSeedDatasets() {
  return Promise.all(Object.values(modelDefinitions).map(async ({ collection: name }) => {
    const content = await readFile(new URL(`../../data/${name}.json`, import.meta.url), 'utf8');
    const documents = mongoose.mongo.BSON.EJSON.parse(content.replace(/^\uFEFF/, ''), { relaxed: true });
    if (!Array.isArray(documents) || documents.some((document) => !document._id)) {
      throw new Error(`${name}.json must contain an array of documents with _id.`);
    }
    return { name, documents };
  }));
}

export async function seedDatabase(connection, datasets) {
  const models = getModels(connection);
  const byCollection = Object.fromEntries(Object.entries(modelDefinitions).map(
    ([name, { collection }]) => [collection, models[name]],
  ));
  // Validate every document before any writes; never replace existing records.
  for (const { name, documents } of datasets) {
    if (!byCollection[name]) throw new Error(`Unknown seed collection: ${name}`);
    for (const document of documents) await new byCollection[name](document).validate();
  }
  await initializeCollections(connection);
  const results = [];
  for (const { name, documents } of datasets) {
    if (!documents.length) continue;
    const result = await byCollection[name].bulkWrite(documents.map((document) => ({
      updateOne: { filter: { _id: document._id }, update: { $setOnInsert: document }, upsert: true },
    })), { setDefaultsOnInsert: false });
    results.push({ name, inserted: result.upsertedCount, preserved: result.matchedCount });
  }
  return results;
}
