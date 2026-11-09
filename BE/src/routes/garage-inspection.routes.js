import { Router } from 'express';
import { requireGarageStaff } from '../middleware/garage-auth.middleware.js';
import { createVehicleInspectionController } from '../controller/garage-inspection.controller.js';
import { createVehicleInspectionRepository } from '../repositories/garage-inspection.repository.js';
import { createVehicleInspectionService } from '../service/garage-inspection.service.js';

export function createGarageInspectionsRouter(database) {
  const router = Router();
  const repository = createVehicleInspectionRepository(database);
  const service = createVehicleInspectionService(repository);
  const controller = createVehicleInspectionController(service);
  router.use(
    ['/inspections', '/inspection-vehicles', '/vehicles/:vehicleId/inspection-eligibility'],
    requireGarageStaff(database, 'vehicle.inspect'),
  );
  router.get('/inspection-vehicles', controller.candidates);
  router.get('/vehicles/:vehicleId/inspection-eligibility', controller.eligibility);
  router.get('/inspections', controller.list);
  router.post('/inspections', controller.create);
  router.get('/inspections/:id', controller.get);
  router.patch('/inspections/:id', controller.update);
  router.post('/inspections/:id/submit', controller.submit);
  return router;
}
