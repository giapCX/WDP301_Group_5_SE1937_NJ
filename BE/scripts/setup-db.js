import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { collections, initializeCollections } from '../src/database/collections.js';

try {
  const database = await connectDatabase();
  await initializeCollections(database);
  console.log(`Database ${database.databaseName}: ${collections.length} collections and indexes are ready.`);
} catch (error) {
  console.error(`Database setup failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
