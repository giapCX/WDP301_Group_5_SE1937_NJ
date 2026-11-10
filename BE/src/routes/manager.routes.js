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
  const requireManager = service.requireRoles('MANAGER');
  const requireManagerOrAdmin = service.requireRoles('MANAGER', 'ADMIN');
  const requireAdmin = service.requireRoles('ADMIN');
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
