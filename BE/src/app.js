import express from 'express';
import cors from 'cors';
import { notFound, errorHandler } from './middleware/error.middleware.js';
import { env } from './config/env.js';
import { createListingsRouter } from './routes/listing.routes.js';
import { createHomepageRouter } from './routes/homepage.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createGarageIntakesRouter } from './routes/garage-intake.routes.js';
import { createGarageInspectionsRouter } from './routes/garage-inspection.routes.js';
import { createManagerRouter } from './routes/manager.routes.js';
import { createGarageHandoverRouter } from './routes/garage-handover.routes.js';
import { createGarageIncidentRouter } from './routes/garage-incident.routes.js';
import { createGaragePhotoRouter } from './routes/garage-photo.routes.js';
import { createGarageWorkspaceRouter } from './routes/garage-workspace.routes.js';
import { createOwnerRouter } from './routes/owner.routes.js';

export function createApp(database, options = {}) {
  const app = express();
  const useLocalFileStorage = options.useLocalFileStorage
    ?? (process.env.NODE_TEST_CONTEXT !== undefined || process.execArgv.includes('--test'));
  app.disable('x-powered-by');
  app.use(cors({ origin: env.frontendOrigin }));
  app.use('/api/owner/vehicles', express.json({ limit: '48mb' }));
  app.use('/api/owner', express.json({ limit: '20mb' }));
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
  app.use('/api/garage', createGarageHandoverRouter(database));
  app.use('/api/garage', createGarageIncidentRouter(database));
  app.use('/api/garage', createGaragePhotoRouter(database, options.garageUploadDirectory, { useLocalFileStorage }));
  app.use('/api/garage', createGarageWorkspaceRouter(database));
  app.use('/api/manager', createManagerRouter(database));
  app.use('/api/owner', createOwnerRouter(database, { useLocalFileStorage, fileRepository: options.ownerFileRepository }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
