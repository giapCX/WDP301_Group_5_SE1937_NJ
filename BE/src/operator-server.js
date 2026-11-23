import cors from 'cors';
import express from 'express';
import { closeDatabase, connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { createSampleOperatorRouter } from './routes/operator-sample.routes.js';

const database = await connectDatabase();
const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', async (_request, response) => {
  try {
    await database.db.command({ ping: 1 });
    response.json({ status: 'ok', database: database.name, module: 'operator' });
  } catch {
    response.status(503).json({ status: 'unavailable' });
  }
});
app.use('/api/operator', createSampleOperatorRouter(database));
app.use((_request, response) => response.status(404).json({ error: { message: 'Không tìm thấy API operator.' } }));
app.use((error, _request, response, _next) => {
  response.status(error.status || 500).json({ error: { message: error.message || 'Lỗi máy chủ.' } });
});

const server = app.listen(env.port, env.host, () => {
  console.log(`Operator BE: http://${env.host}:${env.port}`);
  console.log(`MongoDB database: ${database.name}`);
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    await closeDatabase();
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
