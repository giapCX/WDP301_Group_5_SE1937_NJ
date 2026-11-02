export function createListingController(service) {
  return {
    list: async (request, response) => response.json(await service.list(request.query)),
    getById: async (request, response) => response.json({
      data: await service.getById(request.params.id)
    })
  };
}
