import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { getModels } from '../src/models/index.js';
import { readFile } from 'node:fs/promises';

try {
  const roles = JSON.parse(await readFile(new URL('../data/roles.json', import.meta.url), 'utf8'));
  const permissions = roles.find((role) => role.code === 'OPERATION_STAFF')?.permissions;
  if (!permissions?.length) throw new Error('Operator permissions are missing from roles.json.');
  const connection = await connectDatabase();
  const { Role } = getModels(connection);
  const result = await Role.updateOne(
    { code: 'OPERATION_STAFF' },
    { $addToSet: { permissions: { $each: permissions } } },
  );
  if (result.matchedCount !== 1) throw new Error('Expected exactly one OPERATION_STAFF role.');
  console.log(`Operator workflow permissions granted for ${connection.name}.`);
} catch (error) {
  console.error(`Operator workflow permission update failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
