const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const mongoose = require('mongoose');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const collection = mongoose.connection.db.collection('maintenance_records');
  const pending = await collection.updateMany({ maintenance_status: 'awaiting_approval' }, {
    $set: { maintenance_status: 'in_progress' }, $unset: { requires_manager_approval: '', approvals: '' },
  });
  const cleaned = await collection.updateMany({
    $or: [{ requires_manager_approval: { $exists: true } }, { approvals: { $exists: true } }],
  }, { $unset: { requires_manager_approval: '', approvals: '' } });
  console.log(`Resumed ${pending.modifiedCount} pending maintenance records and removed approval fields from ${cleaned.modifiedCount} records.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
