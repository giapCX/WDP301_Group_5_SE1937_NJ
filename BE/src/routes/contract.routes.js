import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createContractRepository } from '../repositories/contract.repository.js';
import { createContractService } from '../service/contract.service.js';
import { getModels } from '../models/index.js';
import { httpError } from '../utils/http-error.js';

export function createContractRouter(connection) {
  const router = Router(), service = createContractService(createContractRepository(connection));
  const { Role } = getModels(connection);
  const actor = (request) => ({ user: request.user, tokenPayload: request.tokenPayload });
  const mode = (request) => request.query.view === 'staff' ? 'staff' : 'party';
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
  router.get('/:type/candidates', blockOperatorWrite, async (req, res) => res.json(await service.candidates(req.params.type, req.query, actor(req))));
  router.post('/:type/prepare/:referenceId', blockOperatorWrite, async (req, res) => res.json({ data: await service.prepare(req.params.type, req.params.referenceId, req.body || {}, actor(req)) }));
  router.get('/:type', requireOperatorRead, async (req, res) => res.json(await service.list(req.params.type, req.query, actor(req), mode(req))));
  router.get('/:type/:id', requireOperatorRead, async (req, res) => res.json({ data: await service.detail(req.params.type, req.params.id, actor(req), mode(req)) }));
  router.post('/:type/:id/sign', blockOperatorWrite, async (req, res) => res.json({ data: await service.sign(req.params.type, req.params.id, req.body, actor(req), mode(req)) }));
  router.post('/:type/:id/operator-intake', requireOperatorIntake, async (req, res) => res.json(await service.confirmOperatorIntake(req.params.type, req.params.id, actor(req))));
  router.post('/:type/:id/manager-review', blockOperatorWrite, async (req, res) => res.json(await service.reviewManagementContract(req.params.id, req.body || {}, actor(req))));
  return router;
}
