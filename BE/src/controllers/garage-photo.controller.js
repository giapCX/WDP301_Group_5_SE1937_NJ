export function createGaragePhotoController(service) {
  return {
    upload: async (request, response) => response.status(201).json({ data: await service.upload(request.body, request.actor) }),
    get: async (request, response) => {
      const file = await service.get(`garage-photos/${request.params.owner}/${request.params.name}`);
      response.set({ 'Content-Type': file.contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' }).send(file.bytes);
    },
  };
}
