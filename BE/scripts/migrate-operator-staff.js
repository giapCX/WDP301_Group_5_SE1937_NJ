import { connectDatabase, closeDatabase } from '../src/config/database.js';
import { getModels } from '../src/models/index.js';

const operations = {
  up: {
    display_name: 'Operator Staff',
    permissions: [
      'operation.dashboard.read',
      'operation.contract.read',
      'operation.contract.intake.confirm',
      'operation.vehicle.read',
      'operation.vehicle.status.update',
      'operation.vehicle.inspection.schedule',
      'operation.incident.read',
      'operation.incident.create',
      'operation.incident.update',
      'operation.incident.evidence.attach',
      'operation.incident.submit',
    ],
  },
  down: {
    display_name: 'Operation Staff',
    permissions: ['listing.create', 'listing.update', 'booking.review', 'withdrawal.process', 'incident.review', 'settlement.prepare'],
  },
};

const direction = process.argv[2];
if (!Object.hasOwn(operations, direction)) {
  console.error('Usage: node scripts/migrate-operator-staff.js <up|down>');
  process.exitCode = 1;
} else {
  try {
    const connection = await connectDatabase();
    const { Role } = getModels(connection);
    const result = await Role.updateOne({ code: 'OPERATION_STAFF' }, { $set: operations[direction] });
    if (result.matchedCount !== 1) throw new Error('Expected exactly one OPERATION_STAFF role.');
    console.log(`OPERATION_STAFF role migration ${direction} completed for ${connection.name}.`);
  } catch (error) {
    console.error(`Operator Staff role migration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}
