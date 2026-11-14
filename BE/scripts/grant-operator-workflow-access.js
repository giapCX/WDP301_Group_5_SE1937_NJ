import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { getModels } from '../src/models/index.js';

const permissions = [
  'operation.vehicle.inspection.review',
  'operation.identity_verification.read',
  'operation.identity_verification.precheck',
];

try {
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
