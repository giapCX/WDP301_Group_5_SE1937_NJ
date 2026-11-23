import { Router } from 'express';
import { requireGarageStaff } from '../middleware/garage-auth.middleware.js';
import { createGarageWorkspaceRepository } from '../repositories/garage-workspace.repository.js';
import { createVehicleInspectionRepository } from '../repositories/garage-inspection.repository.js';
import { createVehicleIntakeRepository } from '../repositories/garage-intake.repository.js';
import { createGarageHandoverRepository } from '../repositories/garage-handover.repository.js';
import { createVehicleInspectionService } from '../services/garage-inspection.service.js';
import { createVehicleIntakeService } from '../services/garage-intake.service.js';
import { createGarageHandoverService } from '../services/garage-handover.service.js';
import { createGarageWorkspaceService } from '../services/garage-workspace.service.js';
import { createGarageWorkspaceController } from '../controllers/garage-workspace.controller.js';

export function createGarageWorkspaceRouter(connection) {
  const router = Router();
  const service = createGarageWorkspaceService(createGarageWorkspaceRepository(connection), createVehicleInspectionService(createVehicleInspectionRepository(connection)), createVehicleIntakeService(createVehicleIntakeRepository(connection)), createGarageHandoverService(createGarageHandoverRepository(connection)));
  router.get('/workspace', requireGarageStaff(connection, ['vehicle.inspect', 'vehicle.intake', 'handover.record', 'case.report']), createGarageWorkspaceController(service).get);
  return router;
}
