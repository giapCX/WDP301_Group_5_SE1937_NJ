import { Router } from 'express';
import { requireGarageStaff } from '../middleware/garage-auth.middleware.js';
import { createGarageHandoverRepository } from '../repositories/garage-handover.repository.js';
import { createGarageHandoverService } from '../service/garage-handover.service.js';
import { createGarageHandoverController } from '../controller/garage-handover.controller.js';

export function createGarageHandoverRouter(connection) {
  const router = Router();
  const controller = createGarageHandoverController(createGarageHandoverService(createGarageHandoverRepository(connection)));
  router.use(['/handovers', '/bookings/:bookingId/handover-eligibility'], requireGarageStaff(connection, 'handover.record'));
  router.get('/bookings/:bookingId/handover-eligibility', controller.eligibility);
  router.get('/handovers/:id', controller.get);
  router.post('/handovers', controller.create);
  router.patch('/handovers/:id', controller.update);
  router.post('/handovers/:id/confirm', controller.confirm);
  return router;
}
