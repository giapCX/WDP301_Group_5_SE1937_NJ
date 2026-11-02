import { Router } from 'express';
import { requireGarageStaff } from '../../../middleware/garage-auth.js';
import { createVehicleIntakeController } from './intake.controller.js';

export function createGarageIntakesRouter(database, authConfig) {
  const router = Router();
  const controller = createVehicleIntakeController(database);
  router.use(
    ['/intakes', '/intake-vehicles', '/vehicles/:vehicleId/intake-eligibility'],
    requireGarageStaff(database, authConfig),
  );
  router.get('/intake-vehicles', controller.candidates);
  router.get('/vehicles/:vehicleId/intake-eligibility', controller.eligibility);
  router.get('/intakes', controller.list);
  router.post('/intakes', controller.create);
  router.get('/intakes/:id', controller.get);
  router.patch('/intakes/:id', controller.update);
  router.post('/intakes/:id/confirm', controller.confirm);
  return router;
}
