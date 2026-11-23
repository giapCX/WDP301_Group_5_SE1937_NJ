export function createHomepageController(service) {
  return {
    getOverview: async (_request, response) => response.json(await service.getOverview())
  };
}
