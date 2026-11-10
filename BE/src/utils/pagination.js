import { httpError } from './http-error.js';

export function parsePaging(query = {}) {
  function integer(value, fallback, max) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw httpError(400, 'page và limit phải là số nguyên dương; limit tối đa 100.');
    return Number(value);
  }
  return { page: integer(query.page, 1, 1000000), limit: integer(query.limit, 10, 100) };
}

// Internal callers without page/limit still receive the complete option/report list.
export async function findPageRows(repository, filter, query = {}, { sort = { _id: -1 }, projection } = {}) {
  const paging = query.page !== undefined || query.limit !== undefined;
  const { page: requestedPage, limit } = parsePaging(query);
  const total = await repository.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  let request = repository.find(filter, { projection }).sort({ ...sort, _id: sort._id ?? -1 });
  if (paging) request = request.skip((page - 1) * limit).limit(limit);
  const rows = await request.exec();
  Object.defineProperty(rows, 'pagination', { value: { page: paging ? page : 1, limit: paging ? limit : Math.max(1, total), total, totalPages: paging ? totalPages : 1, pages: paging ? totalPages : 1 } });
  return rows;
}
