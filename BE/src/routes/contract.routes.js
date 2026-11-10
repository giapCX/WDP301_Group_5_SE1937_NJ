import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createContractRepository } from '../repositories/contract.repository.js';
import { createContractService } from '../service/contract.service.js';

export function createContractRouter(connection) {
  const router = Router(), service = createContractService(createContractRepository(connection));
  const actor = (request) => ({ user: request.user, tokenPayload: request.tokenPayload });
  const mode = (request) => request.query.view === 'staff' ? 'staff' : 'party';
  router.use(createAuthMiddleware(connection));
  router.get('/:type/candidates', async (req, res) => res.json(await service.candidates(req.params.type, req.query, actor(req))));
  router.post('/:type/prepare/:referenceId', async (req, res) => res.json({ data: await service.prepare(req.params.type, req.params.referenceId, req.body || {}, actor(req)) }));
  router.get('/:type', async (req, res) => res.json(await service.list(req.params.type, req.query, actor(req), mode(req))));
  router.get('/:type/:id', async (req, res) => res.json({ data: await service.detail(req.params.type, req.params.id, actor(req), mode(req)) }));
  router.post('/:type/:id/sign', async (req, res) => res.json({ data: await service.sign(req.params.type, req.params.id, req.body, actor(req), mode(req)) }));
  return router;
}
