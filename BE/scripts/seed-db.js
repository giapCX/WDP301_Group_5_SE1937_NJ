import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { readSeedDatasets, seedDatabase } from '../src/database/seed.js';

try {
  const datasets = await readSeedDatasets();
  const connection = await connectDatabase();
  const results = await seedDatabase(connection, datasets);
  for (const { name, inserted, preserved } of results) {
    console.log(`${name}: ${inserted} inserted, ${preserved} existing documents preserved.`);
  }
  const inserted = results.reduce((total, result) => total + result.inserted, 0);
  console.log(`Seed completed for ${connection.name}: ${inserted} new documents. No collections were dropped.`);
} catch (error) {
  console.error(`Database seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
