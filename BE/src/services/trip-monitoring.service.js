const repository = require('../repositories/trip-monitoring.repository');
const HttpError = require('../utils/http-error');

function positive(value, name) {
  if (
    !['number', 'string'].includes(typeof value) ||
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1
  )
    throw new HttpError(400, `${name} không hợp lệ`);
  return Number(value);
}
async function list(query = {}) {
  const page = query.page === undefined ? 1 : positive(query.page, 'page');
  const limit = query.limit === undefined ? 10 : positive(query.limit, 'limit');
  const status = query.status === undefined ? 'in_progress' : query.status;
  if (limit > 10 || !Number.isSafeInteger((page - 1) * limit))
    throw new HttpError(400, 'Phân trang tối đa 10 chuyến');
  if (!['all', 'confirmed', 'in_progress', 'completed'].includes(status))
    throw new HttpError(400, 'Trạng thái không hợp lệ');
  return repository.list({ status, page, limit });
}
async function detail(value) {
  const result = await repository.detail(positive(value, 'booking_id'));
  if (!result) throw new HttpError(404, 'Không tìm thấy chuyến đi');
  return result;
}
module.exports = { list, detail };
