import { readFile } from 'node:fs/promises';
import { BSON } from 'mongodb';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { collections, initializeCollections } from '../src/database/collections.js';

try {
  // Parse every file before writing anything. EJSON converts $oid and $date
  // into BSON ObjectId and Date rather than storing their wrapper objects.
  const datasets = await Promise.all(collections.map(async ({ name }) => {
    const content = await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8');
    const documents = BSON.EJSON.parse(content.replace(/^\uFEFF/, ''), { relaxed: true });
    if (!Array.isArray(documents) || documents.some(document => !document._id)) {
      throw new Error(`${name}.json must contain an array of documents with _id.`);
    }
    return { name, documents };
  }));

  const database = await connectDatabase();
  await initializeCollections(database);
  let inserted = 0;
  for (const { name, documents } of datasets) {
    if (documents.length === 0) continue;
    const result = await database.collection(name).bulkWrite(documents.map(document => ({
      updateOne: {
        filter: { _id: document._id },
        update: { $setOnInsert: document },
        upsert: true,
      },
    })));
    inserted += result.upsertedCount;
    console.log(`${name}: ${result.upsertedCount} inserted, ${result.matchedCount} existing documents preserved.`);
  }
  console.log(`Seed completed for ${database.databaseName}: ${inserted} new documents. No collections were dropped.`);
} catch (error) {
  console.error(`Database seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
