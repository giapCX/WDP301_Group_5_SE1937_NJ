import { Router } from 'express';
import { env } from '../config/env.js';
import { requireGarageStaff } from '../middleware/garage-auth.middleware.js';
import { createGaragePhotoRepository } from '../repositories/garage-photo.repository.js';
import { createCloudinaryGaragePhotoRepository } from '../repositories/cloudinary-garage-photo.repository.js';
import { createGaragePhotoService } from '../service/garage-photo.service.js';
import { createGaragePhotoController } from '../controller/garage-photo.controller.js';

export function createGaragePhotoRouter(connection, directory, { useLocalFileStorage = false } = {}) {
  const router = Router();
  const configured = Object.values(env.cloudinary).filter(Boolean).length;
  if (!useLocalFileStorage && directory === undefined && configured > 0 && configured < 3) {
    throw new Error('Configure all three CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET variables.');
  }
  const repository = !useLocalFileStorage && directory === undefined && configured === 3
    ? createCloudinaryGaragePhotoRepository(env.cloudinary)
    : createGaragePhotoRepository(directory ?? env.garageUploadDirectory);
  const controller = createGaragePhotoController(createGaragePhotoService(repository));
  router.use('/photos', requireGarageStaff(connection, ['vehicle.inspect', 'vehicle.intake', 'handover.record', 'case.report']));
  router.post('/photos', controller.upload);
  router.get('/photos/:owner/:name', controller.get);
  return router;
}
