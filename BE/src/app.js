import { createRenterRouter } from './routes/renter.routes.js';
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
import { createOperationIncidentRouter } from './routes/operation-incident.routes.js';
import { createContractRouter } from './routes/contract.routes.js';
import { createIdentityVerificationRouter } from './routes/identity-verification.routes.js';
import { createCloudinaryOwnerFileRepository } from './repositories/cloudinary-owner-file.repository.js';
import { createGridFsOwnerFileRepository } from './repositories/gridfs-owner-file.repository.js';
import { createOperationRouter } from './routes/operation.routes.js';

export function createApp(database, options = {}) {
  const app = express();
  const useLocalFileStorage = options.useLocalFileStorage
    ?? (process.env.NODE_TEST_CONTEXT !== undefined || process.execArgv.includes('--test'));
  const cloudinaryConfigured = Object.values(env.cloudinary).filter(Boolean).length;
  if (!useLocalFileStorage && cloudinaryConfigured > 0 && cloudinaryConfigured < 3) {
    throw new Error('Configure all three CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET variables.');
  }
  const privateFileRepository = options.privateFileRepository || (useLocalFileStorage || cloudinaryConfigured !== 3
    ? createGridFsOwnerFileRepository(database)
    : createCloudinaryOwnerFileRepository(env.cloudinary));
  app.disable('x-powered-by');
  app.use(cors({ origin: env.frontendOrigin }));
  app.use('/api/owner/vehicles', express.json({ limit: '48mb' }));
  app.use('/api/owner', express.json({ limit: '20mb' }));
  app.use('/api/identity-verifications', express.json({ limit: '12mb' }));
  app.use('/api/renter/files', express.json({ limit: '29mb' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_request, response) => {
    try {
      await database.db.command({ ping: 1 });
      response.json({ status: 'ok', database: database.name });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });
  app.use('/api/renter', createRenterRouter(database));
  app.use('/api/auth', createAuthRouter(database));
  app.use('/api/identity-verifications', createIdentityVerificationRouter(database, privateFileRepository));
  app.use('/api/listings', createListingsRouter(database));
  app.use('/api/homepage', createHomepageRouter(database));
  app.use('/api/garage', createGarageIntakesRouter(database));
  app.use('/api/garage', createGarageInspectionsRouter(database));
  app.use('/api/garage', createGarageHandoverRouter(database));
  app.use('/api/garage', createGarageIncidentRouter(database));
  app.use('/api/garage', createGaragePhotoRouter(database, options.garageUploadDirectory, { useLocalFileStorage }));
  app.use('/api/garage', createGarageWorkspaceRouter(database));
  app.use('/api/manager', createManagerRouter(database, { fileRepository: privateFileRepository }));
  app.use('/api/owner', createOwnerRouter(database, { useLocalFileStorage, fileRepository: options.ownerFileRepository || privateFileRepository }));
  app.use('/api/operations', createOperationIncidentRouter(database));
  app.use('/api/contracts', createContractRouter(database));
  app.use('/api/operation', createOperationRouter(database));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
