import { Router } from 'express';
import { createListingRepository } from '../repositories/listing.repository.js';
import { createListingService } from '../service/listing.service.js';
import { createListingController } from '../controller/listing.controller.js';
export function createListingsRouter(database, files) {
  const controller = createListingController(createListingService(createListingRepository(database), files));
  const router = Router();
  router.get('/', controller.list);
  router.get('/:id/photos/:index', controller.photo);
  router.get('/:id', controller.getById);
  return router;
}
