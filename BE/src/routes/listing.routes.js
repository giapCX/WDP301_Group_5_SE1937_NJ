import { Router } from 'express';
import { createListingRepository } from '../repositories/listing.repository.js';
import { createListingService } from '../services/listing.service.js';
import { createListingController } from '../controllers/listing.controller.js';
import { createVietTourListingRepository } from '../repositories/viet-tour-listing.repository.js';
export function createPublicListingRepository(database) {
  return database.name === 'viet_tour'
    ? createVietTourListingRepository(database)
    : createListingRepository(database);
}

export function createListingsRouter(database, files) {
  const controller = createListingController(createListingService(createPublicListingRepository(database), files));
  const router = Router();
  router.get('/', controller.list);
  router.get('/:id/photos/:index', controller.photo);
  router.get('/:id', controller.getById);
  return router;
}
