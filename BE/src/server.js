import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, closeDatabase } from './config/database.js';

try {
  const database = await connectDatabase();
  const server = createApp(database).listen(env.port, env.host, () => {
    console.log(`XeDi BE: http://${env.host}:${env.port}`);
    console.log(`MongoDB database: ${database.databaseName}`);
  });
  server.on('error', async error => {
    console.error(`Server failed: ${error.message}`);
    await closeDatabase();
    process.exitCode = 1;
  });
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      await closeDatabase();
      clearTimeout(timeout);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error(`Cannot start backend: ${error.message}`);
  await closeDatabase();
  process.exitCode = 1;
}
