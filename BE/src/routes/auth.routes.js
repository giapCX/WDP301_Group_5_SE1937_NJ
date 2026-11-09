import { Router } from 'express';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../service/auth.service.js';
import { createAuthController } from '../controller/auth.controller.js';
export function createAuthRouter(database) {
  const controller = createAuthController(createAuthService(createAuthRepository(database)));
  const router = Router();
  router.post('/login', controller.login);
  router.get('/me', controller.me);
  router.post('/logout', controller.logout);
  return router;
}
