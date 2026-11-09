import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createOwnerController } from '../controller/owner.controller.js';
import { createOwnerRepository } from '../repositories/owner.repository.js';
import { createOwnerService } from '../service/owner.service.js';

export function createOwnerRouter(connection) {
  const router = Router();
  const repository = createOwnerRepository(connection);
  const service = createOwnerService(repository);
  const controller = createOwnerController(service);
  router.use(createAuthMiddleware(connection));
  router.get('/dashboard', controller.dashboard);
  router.post('/vehicles', controller.registerVehicle);
  return router;
}
