import { notFound, errorHandler } from './middleware/error.middleware.js';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { createListingsRouter } from './routes/listing.routes.js';
import { createHomepageRouter } from './routes/homepage.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createGarageIntakesRouter } from './routes/garage-intake.routes.js';
import { createGarageInspectionsRouter } from './routes/garage-inspection.routes.js';
import { createManagerRouter } from './routes/manager.routes.js';

export function createApp(database) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.frontendOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_request, response) => {
    try {
      await database.db.command({ ping: 1 });
      response.json({ status: 'ok', database: database.name });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });
  app.use('/api/auth', createAuthRouter(database));
  app.use('/api/listings', createListingsRouter(database));
  app.use('/api/homepage', createHomepageRouter(database));
  app.use('/api/garage', createGarageIntakesRouter(database));
  app.use('/api/garage', createGarageInspectionsRouter(database));
  app.use('/api/manager', createManagerRouter(database));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
