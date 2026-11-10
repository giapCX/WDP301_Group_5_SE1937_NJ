import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createOwnerController } from '../controller/owner.controller.js';
import { env } from '../config/env.js';
import { createCloudinaryOwnerFileRepository } from '../repositories/cloudinary-owner-file.repository.js';
import { createGridFsOwnerFileRepository } from '../repositories/gridfs-owner-file.repository.js';
import { createOwnerRepository } from '../repositories/owner.repository.js';
import { createOwnerService } from '../service/owner.service.js';

export function createOwnerRouter(connection, { useLocalFileStorage = false, fileRepository } = {}) {
  const router = Router();
  const configured = Object.values(env.cloudinary).filter(Boolean).length;
  if (!useLocalFileStorage && configured > 0 && configured < 3) {
    throw new Error('Configure all three CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET variables.');
  }
  const files = fileRepository || (!useLocalFileStorage && configured === 3
    ? createCloudinaryOwnerFileRepository(env.cloudinary)
    : createGridFsOwnerFileRepository(connection));
  const repository = createOwnerRepository(connection, files);
  const service = createOwnerService(repository);
  const controller = createOwnerController(service);
  router.use(createAuthMiddleware(connection));
  router.get('/dashboard', controller.dashboard);
  router.post('/vehicles', controller.registerVehicle);
  router.get('/agreements/:id', controller.agreementDetails);
  router.post('/agreements/:id/sign', controller.signAgreement);
  router.post('/payout-requests', controller.requestPayout);
  router.post('/vehicle-withdrawals', controller.requestVehicleWithdrawal);
  router.post('/incidents', controller.reportIncident);
  return router;
}
