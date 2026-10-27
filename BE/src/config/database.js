import { MongoClient } from 'mongodb';
import { env } from './env.js';

const client = new MongoClient(env.mongoUri, { serverSelectionTimeoutMS: 5000 });

export async function connectDatabase() {
  await client.connect();
  const database = client.db(env.databaseName);
  await database.command({ ping: 1 });
  return database;
}

export async function closeDatabase() {
  await client.close();
}
