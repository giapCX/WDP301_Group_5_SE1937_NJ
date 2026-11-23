export function createContractController(service) {
  const actor = (request) => ({ user: request.user, tokenPayload: request.tokenPayload });
  const mode = (request) => request.query.view === 'staff' ? 'staff' : 'party';
  return {
    candidates: async (req, res) => res.json(await service.candidates(req.params.type, req.query, actor(req))),
    prepare: async (req, res) => res.json({ data: await service.prepare(req.params.type, req.params.referenceId, req.body || {}, actor(req)) }),
    list: async (req, res) => res.json(await service.list(req.params.type, req.query, actor(req), mode(req))),
    detail: async (req, res) => res.json({ data: await service.detail(req.params.type, req.params.id, actor(req), mode(req)) }),
    sign: async (req, res) => res.json({ data: await service.sign(req.params.type, req.params.id, req.body, actor(req), mode(req)) }),
    confirmOperatorIntake: async (req, res) => res.json(await service.confirmOperatorIntake(req.params.type, req.params.id, actor(req))),
    reviewManagementContract: async (req, res) => res.json(await service.reviewManagementContract(req.params.id, req.body || {}, actor(req))),
  };
}
