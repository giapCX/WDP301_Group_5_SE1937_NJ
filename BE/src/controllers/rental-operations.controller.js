export function createRentalOperationsController(service, approvals, { operatorQueue = false } = {}) {
  const input = (request) => ({
    query: request.query,
    body: request.body,
    id: request.params.id,
    actorId: request.user._id,
    operatorQueue,
  });

  return {
    bookings: async (request, response) => response.json(await service.bookings(input(request))),
    decideBooking: async (request, response) => response.json(await approvals.decideBooking(input(request), {
      user: request.user,
      tokenPayload: request.tokenPayload,
    })),
    listings: async (request, response) => response.json(await service.listings(input(request))),
    updateListing: async (request, response) => response.json(await service.updateListing(input(request))),
    reviewListing: async (request, response) => response.json(await service.reviewListing(input(request))),
  };
}
