export function createOperatorController(service) {
  return {
    dashboard: async (request, response) => response.json(await service.dashboard({
      permissions: request.currentPermissions,
      isAdmin: request.currentRoles?.includes('ADMIN'),
    })),
    inspectionWorkflow: async (request, response) => response.json(
      await service.listInspectionWorkflow(request.query),
    ),
    vehicles: async (request, response) => response.json(await service.listVehicles(request.query)),
    garageStaff: async (_request, response) => response.json(await service.listGarageStaff()),
    vehicle: async (request, response) => response.json(await service.getVehicle(request.params.id)),
    vehicleDocument: async (request, response) => {
      const file = await service.readVehicleDocument(request.params.id, request.params.kind);
      response.set({
        'Content-Type': file.contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      }).send(file.bytes);
    },
    updateVehicleStatus: async (request, response) =>
      response.json(await service.updateVehicleStatus(request, request.params.id, request.body)),
    scheduleVehicleInspection: async (request, response) =>
      response.status(201).json(await service.scheduleVehicleInspection(request, request.params.id, request.body)),
    updateVehicleInspectionSchedule: async (request, response) =>
      response.json(await service.updateVehicleInspectionSchedule(request, request.params.id, request.body)),
    precheckVehicleInspection: async (request, response) =>
      response.json(await service.precheckVehicleInspection(request, request.params.id, request.body)),
    incidents: async (request, response) =>
      response.json(await service.listIncidents(request, request.query)),
    incident: async (request, response) => response.json(await service.getIncident(request.params.id)),
    createIncident: async (request, response) =>
      response.status(201).json(await service.createIncident(request, request.body)),
    updateIncident: async (request, response) =>
      response.json(await service.updateIncident(request, request.params.id, request.body)),
    evidence: async (request, response) => {
      const file = await service.readEvidence(request.params.id, request.params.index);
      const safeName = file.fileName.replace(/[\r\n"]/g, '_');
      response.set({
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      }).send(file.bytes);
    },
    attachEvidence: async (request, response) =>
      response.status(201).json(await service.attachEvidence(request, request.params.id, request.body)),
    submitIncident: async (request, response) =>
      response.json(await service.submitIncident(request, request.params.id)),
  };
}
