import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { createListingsRouter } from './routes/listings.js';
import { createHomepageRouter } from './routes/homepage.js';

export function createApp(database) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.frontendOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_request, response) => {
    try {
      await database.command({ ping: 1 });
      response.json({ status: 'ok', database: database.databaseName });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });
  app.use('/api/listings', createListingsRouter(database));
  app.use('/api/homepage', createHomepageRouter(database));

  app.use((_request, response) => response.status(404).json({ error: { message: 'API route not found.' } }));
  app.use((error, _request, response, _next) => {
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error(error);
    response.status(status).json({ error: { message: status === 500 ? 'Internal server error.' : error.message } });
  });
  return app;
}
