import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createIdentityVerificationController } from '../controller/identity-verification.controller.js';
import { createIdentityVerificationRepository } from '../repositories/identity-verification.repository.js';
import { createIdentityVerificationService } from '../service/identity-verification.service.js';

export function createIdentityVerificationRouter(connection, fileRepository) {
  const router = Router();
  const service = createIdentityVerificationService(createIdentityVerificationRepository(connection, fileRepository), fileRepository);
  const controller = createIdentityVerificationController(service);
  router.use(createAuthMiddleware(connection));
  router.get('/me', controller.mine);
  router.post('/', controller.submit);
  return router;
}
