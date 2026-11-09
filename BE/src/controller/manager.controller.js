export function createManagerController(service) {
  const input = (request) => ({ query: request.query, body: request.body, id: request.params.id, type: request.params.type, actorId: request.user._id });
  return {
    dashboard: async (request, response) => response.json(await service.dashboard(input(request))),
    vehicles: async (request, response) => response.json(await service.vehicles(input(request))),
    reviewVehicle: async (request, response) => response.json(await service.reviewVehicle(input(request))),
    incidents: async (request, response) => response.json(await service.incidents(input(request))),
    reviewCompensation: async (request, response) => response.json(await service.reviewCompensation(input(request))),
    reviewIncident: async (request, response) => response.json(await service.reviewIncident(input(request))),
    policies: async (request, response) => response.json(await service.policies(input(request))),
    updatePolicy: async (request, response) => response.status(201).json(await service.updatePolicy(input(request))),
    staff: async (request, response) => response.json(await service.staff(input(request))),
    updateStaff: async (request, response) => response.json(await service.updateStaff(input(request))),
    inspectionReport: async (request, response) => response.json(await service.inspectionReport(input(request))),
    financeReport: async (request, response) => response.json(await service.financeReport(input(request))),
  };
}
