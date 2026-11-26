const service = require('../services/management.service');

async function list(request, response) {
  const items = await service.listResource(request.params.resource, request.user.role_name);
  response.set('Cache-Control', 'no-store').json({ items });
}

async function create(request, response) {
  const item = await service.createResource(request.params.resource, request.user.role_name, request.user.user_id, request.body);
  response.status(201).json({ item });
}

async function update(request, response) {
  const result = await service.updateResource(request.params.resource, request.user.role_name, request.user.user_id, request.params.id, request.body);
  response.json(result);
}

async function driverCandidates(request, response) {
  const items = await service.listDriverCandidates();
  response.set('Cache-Control', 'no-store').json({ items });
}

module.exports = { create, driverCandidates, list, update };
