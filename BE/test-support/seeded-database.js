import { randomUUID } from 'node:crypto';
import { startIntakeTestReplica } from './intake-replica.js';
import { useTestDatabase } from './mongoose.js';
import { readSeedDatasets, seedDatabase } from '../src/database/seed.js';

let fixture;
export async function connectTestDatabase() {
  const replica = await startIntakeTestReplica();
  const name = `xedi_seeded_test_${randomUUID().replaceAll('-', '')}`;
  const connection = useTestDatabase(replica.client, name);
  fixture = { replica, connection };
  await seedDatabase(connection, await readSeedDatasets());
  return connection;
}

export async function closeTestDatabase() {
  if (!fixture) return;
  try {
    await fixture.connection.dropDatabase();
  } finally {
    await fixture.replica.close();
    fixture = undefined;
  }
}
