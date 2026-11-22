const bookingRepository = require('../repositories/booking.repository');
const HttpError = require('../utils/http-error');

function parsePositiveInteger(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : value;

  if (
    (typeof normalized !== 'number' && typeof normalized !== 'string') ||
    (typeof normalized === 'string' && !/^\d+$/.test(normalized))
  ) {
    throw new HttpError(400, `${field} phải là số nguyên dương`);
  }

  const number = Number(normalized);

  if (!Number.isSafeInteger(number) || number < 1) {
    throw new HttpError(400, `${field} phải là số nguyên dương hợp lệ`);
  }

  return number;
}

async function getBookings(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new HttpError(400, 'Tham số tìm kiếm không hợp lệ');
  }

  const page = query.page === undefined ? 1 : parsePositiveInteger(query.page, 'page');
  const limit = query.limit === undefined ? 10 : parsePositiveInteger(query.limit, 'limit');

  if (limit > 100) {
    throw new HttpError(400, 'limit không được vượt quá 100');
  }

  if (!Number.isSafeInteger((page - 1) * limit)) {
    throw new HttpError(400, 'Phạm vi phân trang quá lớn');
  }

  let status;

  if (query.status !== undefined) {
    if (typeof query.status !== 'string') {
      throw new HttpError(400, 'status phải là chuỗi');
    }

    status = query.status.trim();

    if (!status || status.length > 30) {
      throw new HttpError(400, 'status phải có từ 1 đến 30 ký tự');
    }
  }

  return bookingRepository.findBookings({
    status,
    page,
    limit,
  });
}

async function getBookingById(id) {
  const bookingId = parsePositiveInteger(id, 'booking_id');
  const booking = await bookingRepository.findBookingById(bookingId);

  if (!booking) {
    throw new HttpError(404, 'Không tìm thấy booking');
  }

  return booking;
}

module.exports = {
  getBookings,
  getBookingById,
};
