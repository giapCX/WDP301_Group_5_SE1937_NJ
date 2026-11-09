import { parseListingsQuery } from '../validators/listing.validator.js';
import { httpError } from '../utils/http-error.js';

export function createListingService(repository) {
  return {
    async list(query) {
      const { start, end, ...filters } = parseListingsQuery(query);
      const result = await repository.findPublic({
        ...filters,
        rentalPeriod: start ? { start, end } : undefined,
      });
      const total = result.count[0]?.total || 0;
      return {
        data: result.data,
        pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
      };
    },
    async getById(id) {
      if (!/^[a-fA-F0-9]{24}$/.test(id)) throw httpError(400, 'Invalid listing ID.');
      const listing = await repository.findPublicById(id);
      if (!listing) throw httpError(404, 'Listing not found.');
      return listing;
    },
  };
}
