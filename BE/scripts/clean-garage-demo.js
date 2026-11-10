import { mkdir, readFile, writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { readSeedDatasets } from '../src/database/seed.js';
import { getModels, modelDefinitions } from '../src/models/index.js';
import { curateGarageDemo, demoVehicleIds, obsoleteInspectionIds, cleanLegacyDemoDocument } from '../src/database/garage-demo.js';

const { EJSON } = mongoose.mongo.BSON;
const stringify = (value) => EJSON.stringify(value, { relaxed: false });
const clone = (value) => EJSON.parse(stringify(value));
const apply = process.argv.includes('--apply');
const obsolete = new Set(obsoleteInspectionIds.map(String));
const sampleId = (document, prefix) => String(document._id).startsWith(prefix + '00000000000000000000');
const junkReason = (value = '') => value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase() === 'khong thich';

try {
  // This command is deliberately restricted to the local development database.
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost|\[::1\])(?=[:/,?])/.test(env.mongoUri)) throw new Error('This cleanup only supports a local MongoDB URI.');
  const originalSeeds = await readSeedDatasets();
  const curated = curateGarageDemo(clone(originalSeeds));
  const connection = await connectDatabase();
  const models = getModels(connection);
  const byCollection = Object.fromEntries(Object.entries(modelDefinitions).map(([key, value]) => [value.collection, models[key]]));
  for (const set of curated) for (const document of set.documents) await new byCollection[set.name](document).validate();
  const seedChanges = curated.filter((set, index) => stringify(set.documents) !== stringify(originalSeeds[index].documents));
  const backup = new URL(`../storage/backups/garage-demo-${new Date().toISOString().replace(/[:.]/g, '-')}/`, import.meta.url);
  if (apply) {
    await mkdir(new URL('seed/', backup), { recursive: true });
    for (const set of originalSeeds) await writeFile(new URL(`seed/${set.name}.json`, backup), await readFile(new URL(`../data/${set.name}.json`, import.meta.url)));
  }
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      const summary = [];
      const snapshot = [];
      for (const { name } of curated) snapshot.push({ name, documents: await connection.collection(name).find({}, { session }).toArray() });
      if (apply) {
        await writeFile(new URL('database.ejson', backup), stringify(snapshot));
        await writeFile(new URL('metadata.json', backup), JSON.stringify({ database: connection.name, createdAt: new Date(), collections: snapshot.map(({ name, documents }) => ({ name, count: documents.length })) }, null, 2));
      }
      for (const { name, documents } of snapshot) {
        let removed = 0, updated = 0, inserted = 0;
        for (const original of documents) {
          const deleteDocument =
            (name === 'incident_cases' && sampleId(original, '0e') && /^Demo .+ report, pending verification$/.test(original.description || '')) ||
            (name === 'notifications' && sampleId(original, '11') && original.content?.startsWith('Thông báo dữ liệu mẫu #')) ||
            (name === 'vehicle_inspections' && obsolete.has(String(original._id))) ||
            (name === 'audit_logs' && (obsolete.has(String(original.entity_id)) || obsolete.has(String(original.sanitized_changes?.inspection_id))));
          if (deleteDocument) {
            if (apply) await connection.collection(name).deleteOne({ _id: original._id }, { session });
            removed += 1;
            continue;
          }
          const next = clone(original);
          if (name === 'vehicles' && String(original._id) === '030000000000000000000010' && junkReason(original.review_note)) {
            next.onboarding_status = 'revision_required';
            delete next.reviewed_by_manager_id;
            delete next.review_note;
            next.registration_history = (next.registration_history || []).filter((item) => !junkReason(item.note));
          }
          cleanLegacyDemoDocument(name, next);
          if (stringify(next) !== stringify(original)) {
            await new byCollection[name](next).validate();
            if (apply) await connection.collection(name).replaceOne({ _id: original._id }, next, { session });
            updated += 1;
          }
        }
        // Insert only the four new scenarios and their linked records; never reset progressed demo workflows.
        const seed = curated.find((set) => set.name === name);
        for (const document of seed.documents) {
          const linked = demoVehicleIds.some((vehicleId) => vehicleId.equals(document.vehicle_id || document._id)) ||
            (name === 'audit_logs' && demoVehicleIds.some((vehicleId) => String(vehicleId) === document.sanitized_changes?.vehicle_id));
          if (!linked || documents.some((item) => item._id.equals(document._id))) continue;
          if (apply) await connection.collection(name).insertOne(document, { session });
          inserted += 1;
        }
        if (removed || updated || inserted) summary.push({ name, removed, updated, inserted });
      }
      console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', seedFiles: seedChanges.map((set) => set.name), collections: summary }, null, 2));
    });
  } finally { await session.endSession(); }
  if (apply) {
    for (const set of seedChanges) await writeFile(new URL(`../data/${set.name}.json`, import.meta.url), EJSON.stringify(set.documents, null, 2, { relaxed: true }) + '\n');
    console.log(`Backup: ${decodeURIComponent(backup.pathname)}`);
  } else console.log('Preview only. Run with --apply to back up and update local data and seed files.');
} catch (error) {
  console.error(`Cleanup failed: ${error.message}`);
  process.exitCode = 1;
} finally { await closeDatabase(); }
