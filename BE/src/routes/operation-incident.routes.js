import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createManagerRepository } from '../repositories/manager.repository.js';
import { createManagerGarageService } from '../service/manager-garage.service.js';
import { httpError } from '../utils/http-error.js';
import { findPageRows } from '../utils/pagination.js';

export function createOperationIncidentRouter(connection) {
  const router = Router();
  const auth = createAuthRepository(connection);
  const repository = createManagerRepository(connection);
  const service = createManagerGarageService(repository);
  router.use(createAuthMiddleware(connection), async (request, _response, next) => {
    const roles = await auth.findRolesByIds([request.user.primary_role_id, ...(request.user.additional_role_ids || [])].filter(Boolean));
    if (!roles.some((role) => role.code === 'OPERATION_STAFF' && role.permissions?.includes('incident.review'))) throw httpError(403, 'Chỉ Operation có quyền điều tra được lập đề xuất.');
    next();
  });
  router.get('/incidents', async (request, response) => {
    const rows = await findPageRows(repository.collection('incident_cases'), { status: { $in: ['reported', 'open', 'investigating', 'awaiting_response', 'pending_review'] } }, { ...request.query, page: request.query.page ?? '1', limit: request.query.limit ?? '10' }, { sort: { created_at: -1 } });
    response.json({ data: rows, pagination: rows.pagination });
  });
  router.post('/incidents/:id/compensation-proposal', async (request, response) => response.status(201).json(await service.proposeCompensation({ id: request.params.id, body: request.body, actorId: request.user._id })));
  return router;
}
