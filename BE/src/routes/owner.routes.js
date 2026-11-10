import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createOwnerController } from '../controller/owner.controller.js';
import { createOwnerRepository } from '../repositories/owner.repository.js';
import { createOwnerService } from '../service/owner.service.js';
import { createContractService } from '../service/contract.service.js';
import { createContractRepository } from '../repositories/contract.repository.js';

export function createOwnerRouter(connection) {
  const router = Router();
  const repository = createOwnerRepository(connection);
  const service = createOwnerService(repository, createContractService(createContractRepository(connection)));
  const controller = createOwnerController(service);
  router.use(createAuthMiddleware(connection));
  router.get('/dashboard', controller.dashboard);
  router.post('/vehicles', controller.registerVehicle);
  router.get('/agreements/:id', controller.agreementDetails);
  router.post('/agreements/:id/sign', controller.signAgreement);
  router.post('/payout-requests', controller.requestPayout);
  router.post('/vehicle-withdrawals', controller.requestVehicleWithdrawal);
  router.post('/incidents', controller.reportIncident);
  return router;
}
