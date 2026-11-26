const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
const mongoose = require('mongoose');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const result = await mongoose.connection.db.collection('roles').updateOne({ role_name: 'manager' }, {
    $pull: { permissions: { $in: ['maintenance.review', 'promotion.manage'] } },
  });
  console.log(`Removed obsolete Manager permission(s); modified ${result.modifiedCount} role record(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
