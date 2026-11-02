import { notFound, errorHandler } from './middlewares/error.middleware.js';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { createListingsRouter } from './modules/listings/listing.routes.js';
import { createHomepageRouter } from './modules/homepage/homepage.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';

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

  app.use('/api/auth', createAuthRouter(database));
  app.use('/api/listings', createListingsRouter(database));
  app.use('/api/homepage', createHomepageRouter(database));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
