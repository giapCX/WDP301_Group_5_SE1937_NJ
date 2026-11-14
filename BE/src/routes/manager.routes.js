import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createManagerRepository } from '../repositories/manager.repository.js';
import { createManagerService } from '../service/manager.service.js';
import { createManagerController } from '../controller/manager.controller.js';
import { attachManagerRoles, requireManagerRoles } from '../middleware/manager-auth.middleware.js';
import { createIdentityVerificationController } from '../controller/identity-verification.controller.js';
import { createIdentityVerificationRepository } from '../repositories/identity-verification.repository.js';
import { createIdentityVerificationService } from '../service/identity-verification.service.js';
import { createContractRepository } from '../repositories/contract.repository.js';
import { createContractService } from '../service/contract.service.js';
import { getModels } from '../models/index.js';

const validObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

export function createManagerRouter(database, { fileRepository } = {}) {
  const router = Router();
  const repository = createManagerRepository(database, fileRepository);
  const service = createManagerService(repository);
  const controller = createManagerController(service);
  const contracts = createContractService(createContractRepository(database));
  const contractActor = (request) => ({ user: request.user, tokenPayload: request.tokenPayload });
  const verificationController = fileRepository
    ? createIdentityVerificationController(createIdentityVerificationService(createIdentityVerificationRepository(database, fileRepository), fileRepository))
    : null;
  router.use(createAuthMiddleware(database), attachManagerRoles(service));
  router.get('/dashboard', controller.dashboard);
  const requireManager = requireManagerRoles('MANAGER');
  const requireManagerOrAdmin = requireManagerRoles('MANAGER', 'ADMIN');
  const requireAdmin = requireManagerRoles('ADMIN');
  router.get('/bookings', requireManager, controller.bookings);
  router.patch('/bookings/:id/decision', requireManager, async (request, response) => {
    const { Booking, RentalAgreement } = getModels(database);
    const existing = request.body?.action === 'approve' && validObjectId(request.params.id)
      ? await Booking.findById(request.params.id).lean()
      : null;
    const agreement = existing?.status === 'awaiting_payment'
      ? await RentalAgreement.findOne({ booking_id: existing._id }).lean()
      : null;
    const contractPendingPreparation = !agreement
      || (!agreement.contract_document && ['draft', 'pending_signatures', 'pending_signature', 'awaiting_signature'].includes(agreement.status));
    const result = existing?.status === 'awaiting_payment' && existing.review_info?.decision === 'approved'
      && contractPendingPreparation
      ? { data: {
        id: String(existing._id),
        status: existing.status,
        decision: 'approved',
        ...(existing.payment_deadline_at ? { paymentDeadline: existing.payment_deadline_at } : {}),
      } }
      : await service.decideBooking({
        query: request.query, body: request.body, id: request.params.id,
        actorId: request.user._id, currentRoles: request.currentRoles,
      });
    if (result.data.status === 'awaiting_payment') {
      const contract = await contracts.prepare('rental', request.params.id, {}, contractActor(request));
      result.data.contractNumber = contract.number;
    }
    response.status(200).json(result);
  });
  router.get('/listings', requireManager, controller.listings);
  router.patch('/listings/:id', requireManager, controller.updateListing);
  router.patch('/listings/:id/review', requireManager, controller.reviewListing);
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
  router.patch('/vehicles/:id/review', requireManager, async (request, response) => {
    let result;
    if (request.body?.action === 'approve' && validObjectId(request.params.id)
      && validObjectId(request.body.inspectionId) && Number.isSafeInteger(request.body.inspectionVersion)) {
      const { Vehicle, VehicleInspection, ManagementAgreement } = getModels(database);
      const vehicle = await Vehicle.findById(request.params.id).lean();
      const inspection = vehicle?.onboarding_status === 'approved'
        ? await VehicleInspection.findOne({
          _id: request.body.inspectionId,
          vehicle_id: vehicle._id,
          approval_status: 'approved',
          recommendation: 'pass',
          version: request.body.inspectionVersion,
        }).lean()
        : null;
      const agreement = inspection
        ? await ManagementAgreement.findOne({
          vehicle_id: vehicle._id,
          status: { $nin: ['terminated', 'expired', 'cancelled'] },
        }).lean()
        : null;
      const contractPendingPreparation = !agreement
        || (!agreement.contract_document && ['draft', 'pending_signatures', 'pending_signature', 'awaiting_signature'].includes(agreement.status));
      if (inspection && contractPendingPreparation) result = { data: { id: String(vehicle._id), status: 'approved' } };
    }
    if (!result) {
      result = await service.reviewVehicle({
        query: request.query, body: request.body, id: request.params.id,
        actorId: request.user._id, currentRoles: request.currentRoles,
      });
    }
    if (result.data.status === 'approved') {
      const { ManagementAgreement } = getModels(database);
      const existing = await ManagementAgreement.findOne({
        vehicle_id: request.params.id,
        status: { $nin: ['terminated', 'expired', 'cancelled'] },
      }).lean();
      if (!existing || ['draft', 'pending_signatures', 'pending_signature', 'awaiting_signature'].includes(existing.status)) {
        const contract = await contracts.prepare('management', request.params.id, {}, contractActor(request));
        result.data.contractNumber = contract.number;
        result.data.contractStatus = contract.status;
      }
    }
    response.status(200).json(result);
  });
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
