import { Router } from 'express';
import { createAuthMiddleware } from '../../middlewares/auth.middleware.js';
import { createOperationController } from './operation.controller.js';
import { createOperationRepository } from './operation.repository.js';
import { createOperationService } from '../../services/operation/operation.service.js';

export function createOperationRouter(database) {
  const router = Router();
  const repository = createOperationRepository(database);
  const service = createOperationService(repository);
  const controller = createOperationController(service);

  router.use(createAuthMiddleware(database), service.authorizeOperationStaff);

  router.get('/dashboard', controller.dashboard);

  // Booking review and listing publication queues.
  router.get('/bookings', controller.bookings);
  router.get('/bookings/:id', controller.booking);
  router.patch('/bookings/:id/decision', controller.decideBooking);
  router.get('/listings', controller.listings);
  router.get('/listings/:id', controller.listing);
  router.patch('/listings/:id', controller.updateListing);
  router.patch('/listings/:id/review', controller.reviewListing);

  // Case investigation and Manager escalation queues.
  router.get('/incidents', controller.incidents);
  router.post('/incidents', controller.createIncident);
  router.get('/incidents/:id', controller.incident);
  router.patch('/incidents/:id', controller.updateIncident);
  router.get('/violations', controller.violations);
  router.get('/violations/:id', controller.violation);
  router.patch('/violations/:id/review', controller.reviewViolation);
  router.get('/disputes', controller.disputes);
  router.get('/disputes/:id', controller.dispute);
  router.patch('/disputes/:id', controller.updateDispute);
  router.get('/complaints', controller.complaints);
  router.get('/complaints/:id', controller.complaint);
  router.patch('/complaints/:id', controller.updateComplaint);

  // Shared assignment and overdue follow-up actions.
  router.get('/staff', controller.staff);
  router.get('/overdue', controller.overdue);
  router.post('/overdue/:id/actions', controller.overdueAction);
  return router;
}
