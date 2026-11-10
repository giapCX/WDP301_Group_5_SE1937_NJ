import { notFound, errorHandler } from './middlewares/error.middleware.js';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { createListingsRouter } from './modules/listings/listing.routes.js';
import { createHomepageRouter } from './modules/homepage/homepage.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createGarageIntakesRouter } from './modules/garage/intakes/intake.routes.js';
import { createGarageInspectionsRouter } from './modules/garage/inspections/inspection.routes.js';
import { createManagerRouter } from './modules/manager/manager.routes.js';
import { createOperationRouter } from './modules/operation/operation.routes.js';

export function createApp(database, options = {}) {
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
  const garageAuth = options.garageAuth || {
    token: env.garageApiToken,
    userId: env.garageStaffId,
    production: process.env.NODE_ENV === 'production',
  };
  app.use('/api/garage', createGarageIntakesRouter(database, garageAuth));
  app.use('/api/garage', createGarageInspectionsRouter(database, garageAuth));
  app.use('/api/manager', createManagerRouter(database));
  app.use('/api/operation', createOperationRouter(database));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
