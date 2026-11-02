import { Router } from 'express';
import { createListingRepository } from './listing.repository.js';
import { createListingService } from './listing.service.js';
import { createListingController } from './listing.controller.js';
export function createListingsRouter(database) {
  const controller = createListingController(createListingService(createListingRepository(database)));
  const router = Router();
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  return router;
}
