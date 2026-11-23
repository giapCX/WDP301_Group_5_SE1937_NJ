import { parseListingsQuery } from '../validators/listing.validator.js';
import { identifyImage } from '../utils/image-content.js';
import { httpError } from '../utils/http-error.js';

export function createListingService(repository, fileRepository) {
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
    async getPublishedPhoto(id, index) {
      if (!/^[a-f0-9]{24}$/.test(id) || !/^[0-4]$/.test(index)) throw httpError(404, 'Không tìm thấy ảnh xe.');
      const key = await repository.findPublishedPhotoKey(id, Number(index));
      if (!key) throw httpError(404, 'Không tìm thấy ảnh xe.');
      const bytes = await fileRepository.read(key);
      const type = identifyImage(bytes);
      if (!type) throw httpError(404, 'Không tìm thấy ảnh xe.');
      return { bytes, contentType: type.contentType };
    },
    async getById(id) {
      if (!/^[a-fA-F0-9]{24}$/.test(id)) throw httpError(400, 'Invalid listing ID.');
      const listing = await repository.findPublicById(id);
      if (!listing) throw httpError(404, 'Listing not found.');
      return listing;
    },
  };
}
