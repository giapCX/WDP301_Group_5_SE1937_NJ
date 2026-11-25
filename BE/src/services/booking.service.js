const bookingRepository = require('../repositories/booking.repository');
const { findAssignableVehicle, hasAssignedTrip } = require('../repositories/renter-reservation.repository');
const HttpError = require('../utils/http-error');
const { tourRentalDays } = require('./quote-calculator');

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

async function getBookingById(id, session = null) {
  const bookingId = parsePositiveInteger(id, 'booking_id');
  const booking = await bookingRepository.findBookingById(bookingId, session);

  if (!booking) {
    throw new HttpError(404, 'Không tìm thấy booking');
  }

  return booking.service_type === 'tour' ? { ...booking, rental_days: tourRentalDays(booking) } : booking;
}

async function getPendingBooking(id, session = null) {
  const booking = await getBookingById(id, session);

  if (booking.booking_status !== 'pending') {
    throw new HttpError(409, 'Booking đã được xử lý hoặc không còn chờ duyệt');
  }

  return booking;
}

function requestedSeats(booking) {
  if (Number.isSafeInteger(booking.requested_seats) && booking.requested_seats > 0) {
    return booking.requested_seats;
  }
  const recordedSeats = booking.requested_seat_count ??
    (booking.service_type ? booking.vehicle?.seat_count : undefined);
  if (
    !Number.isSafeInteger(recordedSeats) ||
    recordedSeats < 1
  ) {
    throw new HttpError(
      409,
      'Booking chưa có số chỗ khách yêu cầu. Cần bổ sung thông tin trước khi điều phối',
    );
  }
  return recordedSeats;
}

function assertVehicleSeats(vehicle, seatCount) {
  if (vehicle.seat_count !== seatCount) {
    throw new HttpError(409, `Khách yêu cầu xe ${seatCount} chỗ; không thể gán xe khác số chỗ`);
  }
}

// reviewedBy must come from the authenticated Operator, never the request body.
async function approveBooking(id, input = {}, reviewedBy) {
  const reviewerId = parsePositiveInteger(reviewedBy, 'reviewed_by');

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'Dữ liệu duyệt booking không hợp lệ');
  }

  return bookingRepository.runInTransaction(async (session) => {
    const booking = await getPendingBooking(id, session);
    if (booking.quote_requested_at) throw new HttpError(409, 'Vui lòng gửi báo giá để khách xác nhận trước.');
    const seatCount = requestedSeats(booking);
    const pickupTime = new Date(booking.pickup_time);
    const estimatedEndTime = new Date(booking.estimated_end_time);
    if (booking.pickup_time == null || booking.estimated_end_time == null ||
        !Number.isFinite(+pickupTime) || !Number.isFinite(+estimatedEndTime) || estimatedEndTime <= pickupTime) {
      throw new HttpError(400, 'Thời gian chuyến đi không hợp lệ');
    }

    const candidate = booking.requested_seats ? await findAssignableVehicle({
      bookingId: booking.booking_id, pickupTime, estimatedEndTime,
      minSeats: seatCount, session,
    }) : null;
    if (booking.requested_seats && !candidate) {
      throw new HttpError(409, 'Không còn xe đủ chỗ trong khung giờ yêu cầu.');
    }

    const vehicleId = parsePositiveInteger(
      candidate?.vehicle_id ?? (input.vehicle_id === undefined ? booking.vehicle_id : input.vehicle_id),
      'vehicle_id',
    );
    if (booking.service_type && !booking.requested_seats && vehicleId !== booking.vehicle_id) {
      throw new HttpError(409, 'Vui lòng duyệt xe đã được báo giá hoặc từ chối để khách chọn lại.');
    }
    const vehicle = await bookingRepository.lockVehicleSchedule(vehicleId, session);

    if (!vehicle) {
      throw new HttpError(404, 'Không tìm thấy xe');
    }
    if (Math.max(booking.requested_seats || 0, booking.passenger_count || 0) > vehicle.seat_count) {
      throw new HttpError(409, 'Xe không đủ chỗ cho số hành khách đã đăng ký.');
    }

    if (!booking.requested_seats && vehicle.seat_count !== seatCount) {
      throw new HttpError(
        409,
        `Khách yêu cầu xe ${seatCount} chỗ; không thể gán xe khác số chỗ`,
      );
    }

    if (!['available', 'in_use'].includes(vehicle.status)) {
      throw new HttpError(409, 'Xe không đủ điều kiện vận hành');
    }

    if (vehicle.status === 'in_use' && pickupTime.getTime() <= Date.now()) {
      throw new HttpError(409, 'Xe đang được sử dụng');
    }

    const overlappingBooking = await bookingRepository.findOverlappingVehicleBooking({
      vehicleId,
      pickupTime,
      estimatedEndTime,
      excludeBookingId: booking.booking_id,
      session,
    });

    if (overlappingBooking || (booking.service_type && await hasAssignedTrip(vehicleId, pickupTime, estimatedEndTime, session))) {
      throw new HttpError(409, 'Xe đã có booking trùng lịch');
    }

    const updated = await bookingRepository.approvePendingBooking({
      bookingId: booking.booking_id,
      vehicleId,
      reviewedBy: reviewerId,
      ...(booking.service_type && { requiresPayment: true }),
      session,
    });

    if (!updated) {
      throw new HttpError(409, 'Booking đã được người khác xử lý, vui lòng tải lại');
    }

    return updated;
  });
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

async function getAvailableVehicles(id) {
  const booking = await getBookingById(id);
  if (!['pending', 'quoted'].includes(booking.booking_status)) throw new HttpError(409, 'Chỉ xem xe khả dụng cho đơn đang xét duyệt hoặc đã báo giá');
  const seatCount = requestedSeats(booking);
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

  const vehicles = await bookingRepository.findAvailableVehicles({
    ...(booking.requested_seats ? { minSeats: seatCount } : { seatCount }),
    bookingId: booking.booking_id,
    pickupTime,
    estimatedEndTime,
  });

  const readiness = require('../repositories/booking-readiness.repository');
  const eligible = [];
  for (const vehicle of vehicles) {
    if (await readiness.vehicleReady(vehicle.vehicle_id, estimatedEndTime) && !await require('../repositories/renter-reservation.repository').hasAssignedTrip(vehicle.vehicle_id, pickupTime, estimatedEndTime, null)) eligible.push(vehicle);
  }
  return {
    booking_id: booking.booking_id,
    pickup_time: pickupTime,
    estimated_end_time: estimatedEndTime,
    vehicles: booking.service_type && !booking.requested_seats
      ? eligible.filter((vehicle) => vehicle.vehicle_id === booking.vehicle_id && vehicle.seat_count >= booking.passenger_count)
      : eligible,
    requested_seat_count: seatCount,
  };
}

module.exports = {
  requestedSeats,
  assertVehicleSeats,
  getAvailableVehicles,
  getBookings,
  getBookingById,
  approveBooking,
  rejectBooking,
};
