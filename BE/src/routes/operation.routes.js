import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createOperationController } from '../controller/operation.controller.js';
import { createOperationRepository } from '../repositories/operation.repository.js';
import { createOperationService } from '../service/operation.service.js';

export function createOperationRouter(database) {
  const router = Router();
  const repository = createOperationRepository(database);
  const service = createOperationService(repository);
  const controller = createOperationController(service);

  router.use(createAuthMiddleware(database), service.authorizeOperationStaff);
  // Workload and booking review.
  router.get('/dashboard', controller.dashboard);
  router.get('/bookings', controller.bookings);
  router.get('/bookings/:id', controller.booking);
  router.patch('/bookings/:id/decision', controller.decideBooking);

  // Listing maintenance and publication.
  router.get('/listings', controller.listings);
  router.get('/listings/:id', controller.listing);
  router.patch('/listings/:id', controller.updateListing);
  router.patch('/listings/:id/review', controller.reviewListing);

  // Vehicle onboarding screening and Garage inspection assignment.
  router.get('/vehicles', controller.vehicles);
  router.get('/vehicles/:id', controller.vehicle);
  router.patch('/vehicles/:id/screen', controller.screenVehicle);
  router.get('/garage-staff', controller.garageStaff);

  // Incident, violation, complaint, and dispute investigation.
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
  router.get('/staff', controller.staff);

  // Overdue rental follow-up and escalation.
  router.get('/overdue', controller.overdue);
  router.post('/overdue/:id/actions', controller.overdueAction);
  return router;
}
