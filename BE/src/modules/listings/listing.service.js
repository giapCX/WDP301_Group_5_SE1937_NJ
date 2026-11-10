function invalidQuery(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
function numberQuery(query, key, fallback, {
  min = 0,
  max = Number.MAX_SAFE_INTEGER
} = {}) {
  if (query[key] === undefined) return fallback;
  if (typeof query[key] !== 'string' || query[key].trim() === '') throw invalidQuery(`${key} must be a number.`);
  const value = Number(query[key]);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw invalidQuery(`${key} must be an integer between ${min} and ${max}.`);
  return value;
}
function textQuery(query, key) {
  if (query[key] === undefined) return undefined;
  if (typeof query[key] !== 'string' || query[key].length > 100) throw invalidQuery(`${key} must be a string of at most 100 characters.`);
  return query[key].trim();
}
export function createListingService(repository) {
  return {
    async list(query) {
      const page = numberQuery(query, 'page', 1, {
        min: 1,
        max: 100000
      });
      const limit = numberQuery(query, 'limit', 12, {
        min: 1,
        max: 100
      });
      const minPrice = numberQuery(query, 'minPrice', undefined);
      const maxPrice = numberQuery(query, 'maxPrice', undefined);
      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) throw invalidQuery('minPrice must not exceed maxPrice.');
      const match = {
        status: 'published'
      };
      const city = textQuery(query, 'city');
      if (city) match['pickup_location.city'] = {
        $regex: city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i'
      };
      const startAt = textQuery(query, 'startAt');
      const endAt = textQuery(query, 'endAt');
      let rentalPeriod;
      if (startAt !== undefined || endAt !== undefined) {
        const start = new Date(startAt);
        const end = new Date(endAt);
        if (!startAt || !endAt || !/^\d{4}-\d{2}-\d{2}T/.test(startAt) || !/^\d{4}-\d{2}-\d{2}T/.test(endAt) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
          throw invalidQuery('startAt and endAt must be valid ISO date-times with endAt after startAt.');
        }
        rentalPeriod = {
          start,
          end
        };
        match.availability_blocks = {
          $not: {
            $elemMatch: {
              start_at: {
                $lt: end
              },
              end_at: {
                $gt: start
              }
            }
          }
        };
      }
      if (minPrice !== undefined || maxPrice !== undefined) {
        match.daily_price = {};
        if (minPrice !== undefined) match.daily_price.$gte = minPrice;
        if (maxPrice !== undefined) match.daily_price.$lte = maxPrice;
      }
      const q = textQuery(query, 'q');
      if (q) match.title = {
        $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i'
      };
      const vehicleMatch = {};
      for (const [queryName, field] of [['fuelType', 'fuel_type'], ['transmission', 'transmission'], ['vehicleType', 'vehicle_type']]) {
        const value = textQuery(query, queryName);
        if (value) vehicleMatch[`vehicle.${field}`] = value;
      }
      const seats = numberQuery(query, 'seats', undefined, {
        min: 1,
        max: 50
      });
      if (seats !== undefined) vehicleMatch['vehicle.seats'] = seats;
      const sortName = textQuery(query, 'sort') || 'newest';
      const sorts = {
        newest: {
          _id: -1
        },
        price_asc: {
          daily_price: 1,
          _id: 1
        },
        price_desc: {
          daily_price: -1,
          _id: 1
        }
      };
      if (!Object.hasOwn(sorts, sortName)) throw invalidQuery('sort must be newest, price_asc or price_desc.');
      const result = await repository.findPublic({
        match,
        vehicleMatch,
        rentalPeriod,
        sort: sorts[sortName],
        page,
        limit
      });
      const total = result.count[0]?.total || 0;
      return {
        data: result.data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    },
    async getById(id) {
      if (!/^[a-fA-F0-9]{24}$/.test(id)) throw invalidQuery('Invalid listing ID.');
      const listing = await repository.findPublicById(id);
      if (!listing) {
        const error = new Error('Listing not found.');
        error.status = 404;
        throw error;
      }
      return listing;
    }
  };
}
