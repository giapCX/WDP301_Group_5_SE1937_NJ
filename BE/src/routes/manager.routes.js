import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createManagerRepository } from '../repositories/manager.repository.js';
import { createManagerService } from '../service/manager.service.js';
import { createManagerController } from '../controller/manager.controller.js';
import { attachManagerRoles, requireManagerRoles } from '../middleware/manager-auth.middleware.js';
import { createIdentityVerificationController } from '../controller/identity-verification.controller.js';
import { createIdentityVerificationRepository } from '../repositories/identity-verification.repository.js';
import { createIdentityVerificationService } from '../service/identity-verification.service.js';

export function createManagerRouter(database, { fileRepository } = {}) {
  const router = Router();
  const repository = createManagerRepository(database, fileRepository);
  const service = createManagerService(repository);
  const controller = createManagerController(service);
  const verificationController = fileRepository
    ? createIdentityVerificationController(createIdentityVerificationService(createIdentityVerificationRepository(database, fileRepository), fileRepository))
    : null;
  router.use(createAuthMiddleware(database), attachManagerRoles(service));
  router.get('/dashboard', controller.dashboard);
  const requireManager = requireManagerRoles('MANAGER');
  const requireManagerOrAdmin = requireManagerRoles('MANAGER', 'ADMIN');
  const requireAdmin = requireManagerRoles('ADMIN');
  router.get('/bookings', requireManager, controller.bookings);
  router.patch('/bookings/:id/decision', requireManager, controller.decideBooking);
  router.get('/listings', requireManager, controller.listings);
  router.patch('/listings/:id', requireManager, controller.updateListing);
  router.patch('/listings/:id/review', requireManager, controller.reviewListing);
  router.get('/admin/overview', requireAdmin, controller.adminOverview);
  router.get('/accounts', requireAdmin, controller.accounts);
  router.post('/accounts', requireAdmin, controller.createAccount);
  router.patch('/accounts/:id', requireAdmin, controller.updateAccount);
  router.get('/roles', requireAdmin, controller.roles);
  router.post('/roles', requireAdmin, controller.createRole);
  router.patch('/roles/:id', requireAdmin, controller.updateRole);
  router.get('/audit-logs', requireAdmin, controller.auditLogs);
  router.get('/reports/system', requireManagerOrAdmin, controller.systemReports);
  router.get('/reports/system/:id', requireManagerOrAdmin, controller.systemReport);
  router.post('/reports/system', requireManagerOrAdmin, controller.saveSystemReport);
  router.get('/vehicles', requireManager, controller.vehicles);
  router.patch('/vehicles/:id/review', requireManager, controller.reviewVehicle);
  router.get('/vehicles/:id/documents/:kind', requireManager, controller.vehicleDocument);
  if (verificationController) {
    router.get('/identity-verifications', requireManager, verificationController.list);
    router.patch('/identity-verifications/:id/review', requireManager, verificationController.review);
    router.get('/identity-verifications/:id/documents/:kind', requireManager, verificationController.download);
  }
  router.get('/incidents', requireManager, controller.incidents);
  router.patch('/incidents/:id/compensation', requireManager, controller.reviewCompensation);
  router.patch('/incidents/:id/violation', requireManager, controller.reviewTrafficViolation);
  router.patch('/incidents/:id/review', requireManager, controller.reviewIncident);
  router.get('/policies', requireManager, controller.policies);
  router.put('/policies/:type', requireManager, controller.updatePolicy);
  router.get('/staff', requireManager, controller.staff);
  router.post('/staff', requireManager, controller.createStaff);
  router.patch('/staff/:id', requireManager, controller.updateStaff);
  router.get('/reports/inspections', requireManager, controller.inspectionReport);
  router.get('/reports/operations', requireManager, controller.operationsReport);
  router.get('/reports/finance', requireManagerOrAdmin, controller.financeReport);
  router.get('/contracts', requireManager, controller.contracts);
  router.patch('/contracts/:type/:id', requireManager, controller.updateContract);
  return router;
}
