import { Router } from 'express';
import { createOperatorController } from '../controller/operator.controller.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createOperatorPermissionMiddleware } from '../middleware/operator-auth.middleware.js';
import { createOperatorRepository } from '../repositories/operator.repository.js';
import { createOperatorService } from '../service/operator.service.js';
import { createIdentityVerificationRepository } from '../repositories/identity-verification.repository.js';
import { createIdentityVerificationService } from '../service/identity-verification.service.js';
import { createIdentityVerificationController } from '../controller/identity-verification.controller.js';

export function createOperatorRouter(connection, files) {
  const router = Router();
  const repository = createOperatorRepository(connection);
  const service = createOperatorService(repository, files);
  const controller = createOperatorController(service);
  const identityController = createIdentityVerificationController(
    createIdentityVerificationService(createIdentityVerificationRepository(connection, files), files),
  );
  const requirePermission = createOperatorPermissionMiddleware(repository.roles);
  router.use(createAuthMiddleware(connection));

  router.get('/dashboard', requirePermission('operation.dashboard.read'), controller.dashboard);
  router.get('/inspection-workflow', requirePermission('operation.vehicle.read'), controller.inspectionWorkflow);
  router.get('/vehicles/garage-staff', requirePermission('operation.vehicle.inspection.schedule'), controller.garageStaff);
  router.get('/vehicles', requirePermission('operation.vehicle.read'), controller.vehicles);
  router.get('/vehicles/:id', requirePermission('operation.vehicle.read'), controller.vehicle);
  router.get('/vehicles/:id/documents/:kind', requirePermission('operation.vehicle.read'), controller.vehicleDocument);
  router.patch('/vehicles/:id/status', requirePermission('operation.vehicle.status.update'), controller.updateVehicleStatus);
  router.post('/vehicles/:id/inspection-schedule', requirePermission('operation.vehicle.inspection.schedule'), controller.scheduleVehicleInspection);
  router.patch('/vehicles/:id/inspection-schedule', requirePermission('operation.vehicle.inspection.schedule'), controller.updateVehicleInspectionSchedule);
  router.post('/inspections/:id/precheck', requirePermission('operation.vehicle.inspection.review'), controller.precheckVehicleInspection);
  router.get('/identity-verifications', requirePermission('operation.identity_verification.read'), identityController.list);
  router.get('/identity-verifications/:id/documents/:kind', requirePermission('operation.identity_verification.read'), identityController.download);
  router.post('/identity-verifications/:id/precheck', requirePermission('operation.identity_verification.precheck'), identityController.precheck);
  router.get('/incidents', requirePermission('operation.incident.read'), controller.incidents);
  router.get('/incidents/:id', requirePermission('operation.incident.read', { allowManager: true }), controller.incident);
  router.get('/incidents/:id/evidence/:index', requirePermission('operation.incident.read', { allowManager: true }), controller.evidence);
  router.post('/incidents', requirePermission('operation.incident.create'), controller.createIncident);
  router.patch('/incidents/:id', requirePermission('operation.incident.update'), controller.updateIncident);
  router.post('/incidents/:id/evidence', requirePermission('operation.incident.evidence.attach'), controller.attachEvidence);
  router.post('/incidents/:id/submit', requirePermission('operation.incident.submit'), controller.submitIncident);
  return router;
}
