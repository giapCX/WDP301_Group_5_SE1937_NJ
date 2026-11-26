const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

const DEFAULT_TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/?replicaSet=rentalLocal';

function connectTestDatabase(mongoose, dbName, options = {}) {
  const uri = process.env.TEST_MONGO_URI || process.env.MONGO_URI || DEFAULT_TEST_MONGO_URI;
  return mongoose.connect(uri, { ...options, dbName });
}

module.exports = { connectTestDatabase };
