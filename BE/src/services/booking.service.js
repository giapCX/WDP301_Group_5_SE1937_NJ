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
  const limit =
    query.limit === undefined ? 10 : parsePositiveInteger(query.limit, 'limit');

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

async function getPendingBooking(id) {
  const booking = await getBookingById(id);

  if (booking.booking_status !== 'pending') {
    throw new HttpError(409, 'Booking đã được xử lý hoặc không còn chờ duyệt');
  }

  return booking;
}

// reviewedBy must come from the authenticated Operator, never the request body.
async function approveBooking(id, input = {}, reviewedBy) {
  const reviewerId = parsePositiveInteger(reviewedBy, 'reviewed_by');

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'Dữ liệu duyệt booking không hợp lệ');
  }

  const booking = await getPendingBooking(id);
  const vehicleId = parsePositiveInteger(
    input.vehicle_id === undefined ? booking.vehicle_id : input.vehicle_id,
    'vehicle_id',
  );
  const vehicle = await bookingRepository.findVehicleById(vehicleId);

  if (!vehicle) {
    throw new HttpError(404, 'Không tìm thấy xe');
  }

  if (!['available', 'in_use'].includes(vehicle.status)) {
    throw new HttpError(409, 'Xe không đủ điều kiện vận hành');
  }

  const pickupTime = new Date(booking.pickup_time);
  const estimatedEndTime = new Date(booking.estimated_end_time);

  if (
    booking.pickup_time == null ||
    booking.estimated_end_time == null ||
    !Number.isFinite(pickupTime.getTime()) ||
    !Number.isFinite(estimatedEndTime.getTime()) ||
    estimatedEndTime <= pickupTime
  ) {
    throw new HttpError(400, 'Thời gian chuyến đi không hợp lệ');
  }

  if (vehicle.status === 'in_use' && pickupTime.getTime() <= Date.now()) {
    throw new HttpError(409, 'Xe đang được sử dụng');
  }

  const overlappingBooking = await bookingRepository.findOverlappingVehicleBooking({
    vehicleId,
    pickupTime,
    estimatedEndTime,
    excludeBookingId: booking.booking_id,
  });

  if (overlappingBooking) {
    throw new HttpError(409, 'Xe đã có booking trùng lịch');
  }

  const updated = await bookingRepository.approvePendingBooking({
    bookingId: booking.booking_id,
    vehicleId,
    reviewedBy: reviewerId,
  });

  if (!updated) {
    throw new HttpError(409, 'Booking đã được người khác xử lý, vui lòng tải lại');
  }

  return updated;
}

async function rejectBooking(id, input = {}, reviewedBy) {
  const reviewerId = parsePositiveInteger(reviewedBy, 'reviewed_by');

  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    typeof input.rejection_reason !== 'string' ||
    !input.rejection_reason.trim()
  ) {
    throw new HttpError(400, 'Phải nhập lý do từ chối booking');
  }

  const booking = await getPendingBooking(id);
  const updated = await bookingRepository.rejectPendingBooking({
    bookingId: booking.booking_id,
    reviewedBy: reviewerId,
    rejectionReason: input.rejection_reason.trim(),
  });

  if (!updated) {
    throw new HttpError(409, 'Booking đã được người khác xử lý, vui lòng tải lại');
  }

  return updated;
}

module.exports = {
  getBookings,
  getBookingById,
  approveBooking,
  rejectBooking,
};
