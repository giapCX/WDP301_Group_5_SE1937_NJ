const { randomInt } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const bookingRepository = require('../repositories/booking.repository');
const requestRepository = require('../repositories/booking-change-request.repository');
const { BookingChangeRequest } = require('../models');
const HttpError = require('../utils/http-error');

function positiveId(value, name) {
  if (
    !['number', 'string'].includes(typeof value) ||
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1
  ) {
    throw new HttpError(400, `${name} không hợp lệ`);
  }
  return Number(value);
}

function snapshot(booking) {
  return {
    pickup_location: booking.pickup_location,
    dropoff_location: booking.dropoff_location,
    pickup_time: new Date(booking.pickup_time),
    estimated_end_time: new Date(booking.estimated_end_time),
    estimated_price: booking.estimated_price,
    trip_stops: [...booking.trip_stops]
      .sort((a, b) => a.stop_order - b.stop_order)
      .map(({ stop_order, location, note }) => ({
        stop_order,
        location,
        note: note ?? null,
      })),
  };
}

async function createChangeRequest(id, input, renterId) {
  const bookingId = positiveId(id, 'booking_id');
  const requesterId = positiveId(renterId, 'requested_by');
  if (
    !input ||
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.trim().length > 2000 ||
    !input.after ||
    typeof input.after !== 'object' ||
    Array.isArray(input.after)
  ) {
    throw new HttpError(400, 'Cần lý do và lịch trình đề xuất hợp lệ');
  }
  const editable = [
    'pickup_location',
    'dropoff_location',
    'pickup_time',
    'estimated_end_time',
    'trip_stops',
  ];
  if (Object.keys(input.after).some((key) => !editable.includes(key))) {
    throw new HttpError(
      400,
      'Chỉ được sửa địa điểm, thời gian và điểm dừng; giá được tính bởi máy chủ',
    );
  }
  return bookingRepository.runInTransaction(async (session) => {
    const booking = await bookingRepository.findBookingById(bookingId, session);
    if (!booking) throw new HttpError(404, 'Không tìm thấy booking');
    if (booking.renter_id !== requesterId)
      throw new HttpError(403, 'Bạn không sở hữu booking này');
    if (
      booking.booking_status !== 'confirmed' ||
      new Date(booking.pickup_time).getTime() <= Date.now()
    ) {
      throw new HttpError(
        409,
        'Chỉ yêu cầu đổi lịch booking đã xác nhận và chưa khởi hành',
      );
    }
    // Shared vehicle write serializes submissions with approvals and schedule changes.
    const vehicle = await bookingRepository.lockVehicleSchedule(
      booking.vehicle_id,
      session,
    );
    if (!vehicle) throw new HttpError(409, 'Booking chưa có xe hợp lệ');
    if (await requestRepository.findPendingForBooking(bookingId, session)) {
      throw new HttpError(409, 'Booking đã có yêu cầu thay đổi đang chờ xử lý');
    }
    const before = snapshot(booking);
    const afterInput = { ...before, ...input.after };
    for (const field of ['pickup_time', 'estimated_end_time']) {
      if (typeof afterInput[field] !== 'string' && !(afterInput[field] instanceof Date))
        throw new HttpError(400, 'Thời gian không hợp lệ');
      afterInput[field] = new Date(afterInput[field]);
    }
    const start = afterInput.pickup_time.getTime();
    const end = afterInput.estimated_end_time.getTime();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start <= Date.now() ||
      end <= start
    )
      throw new HttpError(400, 'Thời gian đề xuất không hợp lệ');
    if (
      !Array.isArray(afterInput.trip_stops) ||
      afterInput.trip_stops.some(
        (stop) =>
          !stop ||
          typeof stop !== 'object' ||
          !Number.isSafeInteger(stop.stop_order) ||
          stop.stop_order < 1,
      ) ||
      new Set(afterInput.trip_stops.map((stop) => stop.stop_order)).size !==
        afterInput.trip_stops.length
    )
      throw new HttpError(400, 'Danh sách điểm dừng không hợp lệ hoặc trùng thứ tự');
    if (!Number.isFinite(vehicle.price_per_day) || vehicle.price_per_day < 0)
      throw new HttpError(409, 'Chưa có giá xe hợp lệ');
    const oldDays = Math.ceil(
      (before.estimated_end_time - before.pickup_time) / 86400000,
    );
    const newDays = Math.ceil((end - start) / 86400000);
    const priceDifference = (newDays - oldDays) * vehicle.price_per_day;
    afterInput.estimated_price = before.estimated_price + priceDifference;
    const document = new BookingChangeRequest({
      change_request_id: randomInt(1, 2 ** 48 - 1),
      booking_id: bookingId,
      requested_by: requesterId,
      requested_at: new Date(),
      reason: input.reason.trim(),
      before,
      after: afterInput,
      price_difference: priceDifference,
      request_status: 'pending',
    });
    try {
      await document.validate();
    } catch (error) {
      if (error.name === 'ValidationError')
        throw new HttpError(400, 'Lịch trình đề xuất không hợp lệ');
      throw error;
    }
    const data = document.toObject({ virtuals: false });
    delete data._id;
    data.after = snapshot(data.after);
    if (isDeepStrictEqual(before, data.after))
      throw new HttpError(400, 'Lịch trình đề xuất chưa có thay đổi');
    return requestRepository.createChangeRequest(data, session);
  });
}

async function getChangeRequestHistory(id, query = {}, renterId) {
  const bookingId = positiveId(id, 'booking_id');
  const requesterId = positiveId(renterId, 'requested_by');
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new HttpError(400, 'Tham số tìm kiếm không hợp lệ');
  }
  const page = query.page === undefined ? 1 : positiveId(query.page, 'page');
  const limit = query.limit === undefined ? 10 : positiveId(query.limit, 'limit');
  if (limit > 10 || !Number.isSafeInteger((page - 1) * limit)) {
    throw new HttpError(400, 'Phân trang không hợp lệ; tối đa 10 bản ghi mỗi trang');
  }
  let status;
  if (query.status !== undefined) {
    if (
      typeof query.status !== 'string' ||
      !BookingChangeRequest.schema
        .path('request_status')
        .enumValues.includes(query.status.trim())
    ) {
      throw new HttpError(400, 'Trạng thái yêu cầu không hợp lệ');
    }
    status = query.status.trim();
  }
  const booking = await bookingRepository.findBookingById(bookingId);
  if (!booking) throw new HttpError(404, 'Không tìm thấy booking');
  if (booking.renter_id !== requesterId)
    throw new HttpError(403, 'Bạn không sở hữu booking này');
  return requestRepository.findRenterHistory({
    bookingId,
    renterId: requesterId,
    status,
    page,
    limit,
  });
}

module.exports = { createChangeRequest, getChangeRequestHistory };
