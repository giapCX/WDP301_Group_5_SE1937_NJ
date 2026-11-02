import { ObjectId } from 'mongodb';

function invalid(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function text(query, key, max = 100) {
  if (query[key] === undefined) return undefined;
  if (typeof query[key] !== 'string' || query[key].length > max)
    throw invalid(`${key} must be a string of at most ${max} characters.`);
  return query[key].trim();
}

function number(query, key, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const raw = text(query, key);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!raw || !Number.isSafeInteger(value) || value < min || value > max)
    throw invalid(`${key} must be an integer between ${min} and ${max}.`);
  return value;
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = (value) => new RegExp(`^${escapeRegex(value)}$`, 'i');

function date(query, key) {
  const raw = text(query, key);
  if (raw === undefined) return undefined;
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      raw,
    ) ||
    !Number.isFinite(Date.parse(raw))
  )
    throw invalid(`${key} must be an ISO date with a timezone.`);
  if (
    new Date(`${raw.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !==
    raw.slice(0, 10)
  )
    throw invalid(`${key} contains an invalid calendar date.`);
  return new Date(raw);
}

export function parseListingsQuery(query) {
  const page = number(query, 'page', 1, 1, 100000);
  const limit = number(query, 'limit', 12, 1, 100);
  const minPrice = number(query, 'minPrice');
  const maxPrice = number(query, 'maxPrice');
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    throw invalid('minPrice must not exceed maxPrice.');
  const match = { status: 'published' };
  if (minPrice !== undefined || maxPrice !== undefined) {
    match.daily_price = {};
    if (minPrice !== undefined) match.daily_price.$gte = minPrice;
    if (maxPrice !== undefined) match.daily_price.$lte = maxPrice;
  }
  const city = text(query, 'city');
  if (city) match['pickup_location.city'] = exact(city);
  const ids = text(query, 'ids', 2500);
  if (ids !== undefined) {
    const values = ids ? ids.split(',') : [];
    if (values.length > 100 || values.some((id) => !/^[a-f\d]{24}$/i.test(id)))
      throw invalid('ids must contain at most 100 comma-separated ObjectIds.');
    match._id = { $in: values.map((id) => new ObjectId(id)) };
  }
  const vehicleMatch = {};
  const q = text(query, 'q');
  if (q)
    vehicleMatch.$or = [
      'title',
      'description',
      'vehicle.brand',
      'vehicle.model',
    ].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } }));
  for (const [key, field, allowed] of [
    ['fuelType', 'fuel_type', ['gasoline', 'diesel', 'electric', 'hybrid']],
    ['transmission', 'transmission', ['automatic', 'manual']],
    [
      'vehicleType',
      'vehicle_type',
      ['sedan', 'suv', 'mpv', 'hatchback', 'pickup'],
    ],
  ]) {
    const raw = text(query, key);
    if (!raw) continue;
    const values = [...new Set(raw.toLowerCase().split(','))];
    if (values.some((value) => !allowed.includes(value)))
      throw invalid(`Invalid ${key}.`);
    vehicleMatch[`vehicle.${field}`] = { $in: values.map(exact) };
  }
  const seats = number(query, 'seats', undefined, 1, 50);
  if (seats !== undefined) vehicleMatch['vehicle.seats'] = seats;
  const minYear = number(query, 'minYear', undefined, 1900, 2100);
  if (minYear !== undefined)
    vehicleMatch['vehicle.manufacture_year'] = { $gte: minYear };
  const start = date(query, 'startAt');
  const end = date(query, 'endAt');
  if (Boolean(start) !== Boolean(end) || (start && end <= start))
    throw invalid(
      'startAt and endAt must be supplied together, with endAt after startAt.',
    );
  if (start)
    match.availability_blocks = {
      $not: { $elemMatch: { start_at: { $lt: end }, end_at: { $gt: start } } },
    };
  const sortName = text(query, 'sort') || 'newest';
  const sorts = {
    newest: { _id: -1 },
    price_asc: { daily_price: 1, _id: 1 },
    price_desc: { daily_price: -1, _id: 1 },
  };
  if (!Object.hasOwn(sorts, sortName))
    throw invalid('sort must be newest, price_asc or price_desc.');
  return {
    page,
    limit,
    match,
    vehicleMatch,
    start,
    end,
    sort: sorts[sortName],
  };
}

export function availabilityPipeline(start, end) {
  if (!start) return [];
  return [
    {
      $lookup: {
        from: 'bookings',
        localField: 'vehicle_id',
        foreignField: 'vehicle_id',
        pipeline: [
          {
            $match: {
              status: {
                $in: ['pending', 'awaiting_payment', 'confirmed', 'ongoing'],
              },
              start_at: { $lt: end },
              end_at: { $gt: start },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'conflicts',
      },
    },
    { $match: { 'conflicts.0': { $exists: false } } },
  ];
}
