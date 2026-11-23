import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { getModels } from '../src/models/index.js';

let connection;
export async function connectDatabase() {
  if (!connection || connection.readyState === 0) {
    connection = mongoose.createConnection(env.mongoUri, {
      dbName: env.databaseName,
      serverSelectionTimeoutMS: 5000,
      autoIndex: false,
      autoCreate: false,
    });
  }
  await connection.asPromise();
  getModels(connection);
  await connection.db.command({ ping: 1 });
  return connection;
}

export async function closeDatabase() {
  if (connection) await connection.close();
}
