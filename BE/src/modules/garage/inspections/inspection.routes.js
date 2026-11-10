import { Router } from 'express';
import { requireGarageStaff } from '../../../middlewares/auth.middleware.js';
import { createVehicleInspectionController } from './inspection.controller.js';

export function createGarageInspectionsRouter(database, authConfig) {
  const router = Router();
  const controller = createVehicleInspectionController(database);
  router.use(
    ['/inspections', '/inspection-vehicles', '/vehicles/:vehicleId/inspection-eligibility'],
    requireGarageStaff(database, authConfig, 'vehicle.inspect'),
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
