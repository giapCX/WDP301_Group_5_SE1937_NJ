export function createManagerController(service, approvals) {
  const input = request => ({ query: request.query, body: request.body, id: request.params.id, type: request.params.type, actorId: request.user._id, currentRoles: request.currentRoles });
  const actor = (request) => ({ user: request.user, tokenPayload: request.tokenPayload });
  return {
    accounts: async (request, response) => response.status(200).json(await service.accounts(input(request))),
    createAccount: async (request, response) => response.status(201).json(await service.createAccount(input(request))),
    updateAccount: async (request, response) => response.status(200).json(await service.updateAccount(input(request))),
    roles: async (request, response) => response.status(200).json(await service.roles(input(request))),
    createRole: async (request, response) => response.status(201).json(await service.createRole(input(request))),
    updateRole: async (request, response) => response.status(200).json(await service.updateRole(input(request))),
    auditLogs: async (request, response) => response.status(200).json(await service.auditLogs(input(request))),
    adminOverview: async (_request, response) => response.status(200).json(await service.adminOverview()),
    systemReports: async (request, response) => response.status(200).json(await service.systemReports(input(request))),
    systemReport: async (request, response) => response.status(200).json(await service.systemReport(input(request))),
    saveSystemReport: async (request, response) => response.status(201).json(await service.saveSystemReport(input(request))),
    dashboard: async (request, response) => response.status(200).json(await service.dashboard(input(request))),
    bookings: async (request, response) => response.status(200).json(await service.bookings(input(request))),
    decideBooking: async (request, response) => response.json(await approvals.decideBooking(input(request), actor(request))),
    listings: async (request, response) => response.status(200).json(await service.listings(input(request))),
    updateListing: async (request, response) => response.status(200).json(await service.updateListing(input(request))),
    reviewListing: async (request, response) => response.status(200).json(await service.reviewListing(input(request))),
    vehicles: async (request, response) => response.status(200).json(await service.vehicles(input(request))),
    reviewVehicle: async (request, response) => response.json(await approvals.reviewVehicle(input(request), actor(request))),
    vehicleDocument: async (request, response) => {
      const file = await service.vehicleDocument({ ...input(request), kind: request.params.kind });
      response.set({ 'Content-Type': file.contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' }).send(file.bytes);
    },
    incidents: async (request, response) => response.status(200).json(await service.incidents(input(request))),
    reviewCompensation: async (request, response) => response.status(200).json(await service.reviewCompensation(input(request))),
    reviewIncident: async (request, response) => response.status(200).json(await service.reviewIncident(input(request))),
    reviewTrafficViolation: async (request, response) => response.status(200).json(await service.reviewTrafficViolation(input(request))),
    policies: async (request, response) => response.status(200).json(await service.policies(input(request))),
    updatePolicy: async (request, response) => response.status(201).json(await service.updatePolicy(input(request))),
    staff: async (request, response) => response.status(200).json(await service.staff(input(request))),
    createStaff: async (request, response) => response.status(201).json(await service.createStaff(input(request))),
    updateStaff: async (request, response) => response.status(200).json(await service.updateStaff(input(request))),
    contracts: async (request, response) => response.status(200).json(await service.contracts(input(request))),
    updateContract: async (request, response) => response.status(request.body?.action === 'amend' ? 201 : 200).json(await service.updateContract(input(request))),
    inspectionReport: async (request, response) => response.status(200).json(await service.inspectionReport(input(request))),
    financeReport: async (request, response) => response.status(200).json(await service.financeReport(input(request))),
    operationsReport: async (request, response) => response.status(200).json(await service.operationsReport(input(request))),
  };
}
