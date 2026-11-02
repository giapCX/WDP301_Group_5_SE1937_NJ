import { Router } from 'express';
import { createHomepageRepository } from './homepage.repository.js';
import { createHomepageService } from './homepage.service.js';
import { createHomepageController } from './homepage.controller.js';
export function createHomepageRouter(database) {
  const controller = createHomepageController(createHomepageService(createHomepageRepository(database)));
  const router = Router();
  router.get('/', controller.getOverview);
  return router;
}
