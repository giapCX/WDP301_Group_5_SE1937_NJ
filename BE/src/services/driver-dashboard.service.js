const repository = require('../repositories/driver-dashboard.repository');
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

async function getProfile(userId) {
  const profile = await repository.profile(userId);
  if (!profile) throw new HttpError(404, 'Tài khoản chưa có hồ sơ tài xế');
  return profile;
}

async function dashboard(userId, query = {}) {
  const page = query.page === undefined ? 1 : positive(query.page, 'page');
  const limit = query.limit === undefined ? 10 : positive(query.limit, 'limit');
  if (limit > 10 || !Number.isSafeInteger((page - 1) * limit))
    throw new HttpError(400, 'Phân trang tối đa 10 chuyến');
  const status = query.status === undefined ? 'all' : query.status;
  if (!['all', 'upcoming', 'active', 'completed'].includes(status))
    throw new HttpError(400, 'Bộ lọc chuyến đi không hợp lệ');
  const profile = await getProfile(userId);
  const rows = await repository.assignedTrips(profile.driver_id);
  const trips = rows.filter(
    (item) => !['rejected', 'cancelled'].includes(item.assignment_status),
  );
  const now = Date.now();
  const upcoming = (item) =>
    item.booking.booking_status === 'confirmed' &&
    new Date(item.booking.pickup_time).getTime() >= now;
  const active = (item) => item.booking.booking_status === 'in_progress';
  const completed = (item) => item.booking.booking_status === 'completed';
  const order = (a, b) =>
    new Date(a.booking.pickup_time) - new Date(b.booking.pickup_time) ||
    a.assignment_id - b.assignment_id;
  const currentTrip =
    [...trips].filter(active).sort(order)[0] ||
    [...trips].filter(upcoming).sort(order)[0] ||
    null;
  const filtered = trips.filter(
    (item) => status === 'all' || { upcoming, active, completed }[status](item),
  );
  filtered.sort(
    status === 'completed' || status === 'all' ? (a, b) => -order(a, b) : order,
  );
  return {
    profile,
    stats: {
      total: trips.length,
      upcoming: trips.filter(upcoming).length,
      active: trips.filter(active).length,
      completed: trips.filter(completed).length,
    },
    currentTrip,
    trips: {
      items: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
      total_pages: Math.ceil(filtered.length / limit),
    },
  };
}

async function detail(userId, id) {
  const bookingId = positive(id, 'booking_id');
  const profile = await getProfile(userId);
  const trip = await repository.tripDetail(profile.driver_id, bookingId);
  if (!trip) throw new HttpError(404, 'Không tìm thấy chuyến được phân công cho bạn');
  return trip;
}

module.exports = { dashboard, detail };
