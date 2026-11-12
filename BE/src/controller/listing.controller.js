export function createListingController(service) {
  return {
    photo: async (request, response) => {
      const { bytes, contentType } = await service.getPublishedPhoto(request.params.id, request.params.index);
      response.set({ 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }).send(bytes);
    },
    list: async (request, response) => response.json(await service.list(request.query)),
    getById: async (request, response) => response.json({
      data: await service.getById(request.params.id)
    })
  };
}
