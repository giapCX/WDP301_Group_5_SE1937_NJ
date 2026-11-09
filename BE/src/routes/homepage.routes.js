import { Router } from 'express';
import { createHomepageRepository } from '../repositories/homepage.repository.js';
import { createHomepageService } from '../service/homepage.service.js';
import { createHomepageController } from '../controller/homepage.controller.js';
export function createHomepageRouter(database) {
  const controller = createHomepageController(createHomepageService(createHomepageRepository(database)));
  const router = Router();
  router.get('/', controller.getOverview);
  return router;
}
