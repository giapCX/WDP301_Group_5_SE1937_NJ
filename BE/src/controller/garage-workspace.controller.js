export function createGarageWorkspaceController(service) {
  return { get: async (request, response) => response.json({ data: await service.get(request.garagePermissions, request.actor) }) };
}
