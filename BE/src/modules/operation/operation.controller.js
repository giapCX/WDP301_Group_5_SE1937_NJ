export function createOperationController(service) {
  return {
    dashboard: async (_request, response) => response.json(await service.dashboard()),

    bookings: async (request, response) =>
      response.json(await service.listBookings(request.query)),
    booking: async (request, response) =>
      response.json(await service.getBooking(request.params.id)),
    decideBooking: async (request, response) =>
      response.json(await service.decideBooking(request, request.params.id, request.body)),

    listings: async (request, response) =>
      response.json(await service.listListings(request.query)),
    listing: async (request, response) =>
      response.json(await service.getListing(request.params.id)),
    updateListing: async (request, response) =>
      response.json(await service.updateListing(request, request.params.id, request.body)),
    reviewListing: async (request, response) =>
      response.json(await service.reviewListing(request, request.params.id, request.body)),

    incidents: async (request, response) =>
      response.json(await service.listIncidents(request)),
    incident: async (request, response) =>
      response.json(await service.getCase(request.params.id)),
    createIncident: async (request, response) =>
      response.status(201).json(await service.createIncident(request, request.body)),
    updateIncident: async (request, response) =>
      response.json(await service.updateCase(request, request.params.id, request.body)),

    violations: async (request, response) =>
      response.json(await service.listViolations(request)),
    violation: async (request, response) =>
      response.json(await service.getCase(request.params.id, 'traffic_violation')),
    reviewViolation: async (request, response) =>
      response.json(await service.proposeViolationReview(request, request.params.id, request.body)),

    disputes: async (request, response) =>
      response.json(await service.listDisputes(request)),
    dispute: async (request, response) =>
      response.json(await service.getCase(request.params.id, 'dispute')),
    updateDispute: async (request, response) =>
      response.json(await service.updateCase(request, request.params.id, request.body, 'dispute')),

    complaints: async (request, response) =>
      response.json(await service.listComplaints(request)),
    complaint: async (request, response) =>
      response.json(await service.getCase(request.params.id, 'complaint')),
    updateComplaint: async (request, response) =>
      response.json(await service.updateCase(request, request.params.id, request.body, 'complaint')),

    staff: async (_request, response) => response.json(await service.listStaff()),
    overdue: async (request, response) =>
      response.json(await service.listOverdue(request.query)),
    overdueAction: async (request, response) =>
      response.json(await service.overdueAction(request, request.params.id, request.body)),
  };
}
