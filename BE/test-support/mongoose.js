import mongoose from 'mongoose';

export function useTestDatabase(client, databaseName) {
  const connection = mongoose.createConnection().setClient(client);
  return connection.useDb(databaseName, { useCache: true });
}
