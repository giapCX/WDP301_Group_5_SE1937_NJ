import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createManagerRepository } from '../repositories/manager.repository.js';
import { createManagerService } from '../service/manager.service.js';
import { createManagerController } from '../controller/manager.controller.js';

export function createManagerRouter(database) {
  const router = Router();
  const repository = createManagerRepository(database);
  const service = createManagerService(repository);
  const controller = createManagerController(service);
  router.use(createAuthMiddleware(database), async (request, _response, next) => {
    request.currentRoles = await service.authorizeDashboard(request.user);
    next();
  });
  router.get('/dashboard', controller.dashboard);
  router.get('/vehicles', controller.vehicles);
  router.patch('/vehicles/:id/review', controller.reviewVehicle);
  router.get('/incidents', controller.incidents);
  router.patch('/incidents/:id/compensation', controller.reviewCompensation);
  router.patch('/incidents/:id/review', controller.reviewIncident);
  router.get('/policies', controller.policies);
  router.put('/policies/:type', controller.updatePolicy);
  router.get('/staff', controller.staff);
  router.patch('/staff/:id', controller.updateStaff);
  router.get('/reports/inspections', controller.inspectionReport);
  router.get('/reports/finance', controller.financeReport);
  return router;
}
