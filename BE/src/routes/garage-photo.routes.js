import { Router } from 'express';
import { env } from '../config/env.js';
import { requireGarageStaff } from '../middleware/garage-auth.middleware.js';
import { createGaragePhotoRepository } from '../repositories/garage-photo.repository.js';
import { createGaragePhotoService } from '../service/garage-photo.service.js';
import { createGaragePhotoController } from '../controller/garage-photo.controller.js';

export function createGaragePhotoRouter(connection, directory = env.garageUploadDirectory) {
  const router = Router();
  const controller = createGaragePhotoController(createGaragePhotoService(createGaragePhotoRepository(directory)));
  router.use('/photos', requireGarageStaff(connection, ['vehicle.inspect', 'vehicle.intake', 'handover.record', 'case.report']));
  router.post('/photos', controller.upload);
  router.get('/photos/:owner/:name', controller.get);
  return router;
}
