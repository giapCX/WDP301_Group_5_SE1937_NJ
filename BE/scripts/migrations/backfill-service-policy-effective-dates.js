const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const mongoose = require('mongoose');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const collection = mongoose.connection.db.collection('service_policies');
  const policies = await collection.find({}).toArray();
  const starts = policies.map((policy) => ({
    ...policy,
    effective_from: policy.effective_from || policy.created_at || policy.updated_at || new Date(0),
    effective_to: policy.effective_to || null,
  }));
  if (starts.some((policy) => !Number.isFinite(new Date(policy.effective_from).getTime()) ||
    (policy.effective_to && (!Number.isFinite(new Date(policy.effective_to).getTime()) || new Date(policy.effective_to) <= new Date(policy.effective_from))))) {
    throw new Error('Found invalid service policy effective dates. Resolve them before migration.');
  }
  const active = starts.filter((policy) => policy.status === 'active')
    .sort((left, right) => new Date(left.effective_from) - new Date(right.effective_from));
  for (let index = 0; index < active.length; index += 1) {
    for (let candidateIndex = index + 1; candidateIndex < active.length; candidateIndex += 1) {
      const current = active[index];
      const candidate = active[candidateIndex];
      if (current.effective_to && new Date(current.effective_to) <= new Date(candidate.effective_from)) break;
      throw new Error(`Overlapping active policies: ${current.policy_id}, ${candidate.policy_id}. Resolve the overlap before migration.`);
    }
  }
  let migrated = 0;
  for (const policy of policies) {
    if (policy.effective_from) continue;
    await collection.updateOne({ policy_id: policy.policy_id, effective_from: { $exists: false } }, {
      $set: { effective_from: policy.created_at || policy.updated_at || new Date(0), effective_to: policy.effective_to || null },
    });
    migrated += 1;
  }
  const { ServicePolicy } = require('../../src/models');
  for (const [fields, options] of ServicePolicy.schema.indexes()) await collection.createIndex(fields, options);
  console.log(`Backfilled effective dates for ${migrated} service policies.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
