import { Router } from 'express';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';
import { createAuthController } from './auth.controller.js';
export function createAuthRouter(database) {
  const controller = createAuthController(createAuthService(createAuthRepository(database)));
  const router = Router();
  router.post('/login', controller.login);
  router.get('/me', controller.me);
  router.post('/logout', controller.logout);
  return router;
}
