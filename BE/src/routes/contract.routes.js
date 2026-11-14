import { Router } from 'express';
import { createContractController } from '../controller/contract.controller.js';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createContractRepository } from '../repositories/contract.repository.js';
import { createContractService } from '../service/contract.service.js';
import { getModels } from '../models/index.js';
import { httpError } from '../utils/http-error.js';

export function createContractRouter(connection) {
  const router = Router(), service = createContractService(createContractRepository(connection));
  const controller = createContractController(service);
  const { Role } = getModels(connection);
  router.use(createAuthMiddleware(connection));
  async function staffRoles(request) {
    const ids = [request.user.primary_role_id, ...(request.user.additional_role_ids || [])].filter(Boolean);
    return ids.length ? Role.find({ _id: { $in: ids } }).lean() : [];
  }
  async function requireOperatorRead(request, _response, next) {
    try {
      const roles = await staffRoles(request);
      const hasReadPermission = roles.some((role) => role.permissions?.includes('operation.contract.read'));
      if (roles.some((role) => role.code === 'OPERATION_STAFF')
        && (!roles.some((role) => role.code === 'MANAGER')
          && (!hasReadPermission
            || request.query.view !== 'staff'))) {
        return next(httpError(403, 'Operator Staff chỉ được xem hợp đồng ở chế độ nền tảng.'));
      }
      next();
    } catch (error) {
      next(error);
    }
  }
  async function blockOperatorWrite(request, _response, next) {
    try {
      const roles = await staffRoles(request);
      if (roles.some((role) => role.code === 'OPERATION_STAFF') && !roles.some((role) => role.code === 'MANAGER')) {
        return next(httpError(403, 'Operator Staff chỉ có quyền xem hợp đồng.'));
      }
      next();
    } catch (error) {
      next(error);
    }
  }
  async function requireOperatorIntake(request, _response, next) {
    try {
      const roles = await staffRoles(request);
      const hasOperatorRole = roles.some((role) => role.code === 'OPERATION_STAFF');
      const hasPermission = roles.some((role) => role.permissions?.includes('operation.contract.intake.confirm'));
      if (!hasOperatorRole || !hasPermission || request.query.view !== 'staff') {
        return next(httpError(403, 'Bạn không có quyền tiếp nhận hợp đồng.'));
      }
      next();
    } catch (error) {
      next(error);
    }
  }
  router.get('/:type/candidates', blockOperatorWrite, controller.candidates);
  router.post('/:type/prepare/:referenceId', blockOperatorWrite, controller.prepare);
  router.get('/:type', requireOperatorRead, controller.list);
  router.get('/:type/:id', requireOperatorRead, controller.detail);
  router.post('/:type/:id/sign', blockOperatorWrite, controller.sign);
  router.post('/:type/:id/operator-intake', requireOperatorIntake, controller.confirmOperatorIntake);
  router.post('/:type/:id/manager-review', blockOperatorWrite, controller.reviewManagementContract);
  return router;
}
