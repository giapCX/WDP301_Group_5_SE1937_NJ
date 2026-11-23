import { Router } from 'express';
import { requireGarageStaff } from '../middleware/garage-auth.middleware.js';
import { createGarageIncidentRepository } from '../repositories/garage-incident.repository.js';
import { createGarageIncidentService } from '../services/garage-incident.service.js';
import { createGarageIncidentController } from '../controllers/garage-incident.controller.js';

export function createGarageIncidentRouter(connection) {
  const router = Router();
  const controller = createGarageIncidentController(createGarageIncidentService(createGarageIncidentRepository(connection)));
  router.use('/incidents', requireGarageStaff(connection, 'case.report'));
  router.get('/incidents/:id', controller.get);
  router.post('/incidents', controller.create);
  return router;
}
