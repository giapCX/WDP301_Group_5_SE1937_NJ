const { isDeepStrictEqual } = require('node:util');
const bookingRepository = require('../repositories/booking.repository');
const changeRequestRepository = require('../repositories/booking-change-request.repository');
const { BookingChangeRequest, TripWorkflow } = require('../models');
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

async function getChangeRequests(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    throw new HttpError(400, 'Tham số tìm kiếm không hợp lệ');
  }

  const page = query.page === undefined ? 1 : parsePositiveInteger(query.page, 'page');
  const limit =
    query.limit === undefined ? 10 : parsePositiveInteger(query.limit, 'limit');

  if (limit > 10) {
    throw new HttpError(400, 'limit không được vượt quá 10');
  }

  if (!Number.isSafeInteger((page - 1) * limit)) {
    throw new HttpError(400, 'Phạm vi phân trang quá lớn');
  }

  let status;

  if (query.status !== undefined) {
    const allowedStatuses = BookingChangeRequest.schema.path('request_status').enumValues;

    if (typeof query.status !== 'string') {
      throw new HttpError(400, 'status phải là chuỗi');
    }

    status = query.status.trim();

    if (!allowedStatuses.includes(status)) {
      throw new HttpError(400, `status phải là một trong: ${allowedStatuses.join(', ')}`);
    }
  }

  const bookingId =
    query.booking_id === undefined
      ? undefined
      : parsePositiveInteger(query.booking_id, 'booking_id');

  return changeRequestRepository.findChangeRequests({
    status,
    bookingId,
    page,
    limit,
  });
}

async function getChangeRequestById(id) {
  const changeRequestId = parsePositiveInteger(id, 'change_request_id');
  const request = await changeRequestRepository.findChangeRequestById(changeRequestId);

  if (!request) {
    throw new HttpError(404, 'Không tìm thấy yêu cầu thay đổi booking');
  }

  return request;
}

function itinerary(value) {
  return {
    pickup_location: value.pickup_location,
    dropoff_location: value.dropoff_location,
    pickup_time: new Date(value.pickup_time).getTime(),
    estimated_end_time: new Date(value.estimated_end_time).getTime(),
    estimated_price: value.estimated_price,
    trip_stops: [...value.trip_stops]
      .sort((a, b) => a.stop_order - b.stop_order)
      .map((stop) => ({
        stop_order: stop.stop_order,
        location: stop.location,
        note: stop.note ?? null,
      })),
  };
}

async function pendingRequest(id, session = null) {
  const request = await changeRequestRepository.findRequestForReview(id, session);
  if (!request) throw new HttpError(404, 'Không tìm thấy yêu cầu thay đổi booking');
  if (request.request_status !== 'pending')
    throw new HttpError(409, 'Yêu cầu đã được xử lý');
  return request;
}

// reviewerId must be supplied by verified Operator authentication.
async function approveChangeRequest(id, reviewerId) {
  const requestId = parsePositiveInteger(id, 'change_request_id');
  const reviewer = parsePositiveInteger(reviewerId, 'reviewed_by');
  return bookingRepository.runInTransaction(async (session) => {
    const request = await pendingRequest(requestId, session);
    const booking = await bookingRepository.findBookingById(request.booking_id, session);
    if (!booking) throw new HttpError(404, 'Không tìm thấy booking');
    if (booking.booking_status !== 'confirmed')
      throw new HttpError(409, 'Chỉ đổi lịch booking đã xác nhận và chưa khởi hành');
    if (request.requested_by !== booking.renter_id)
      throw new HttpError(409, 'Người yêu cầu không phải chủ booking');
    try {
      await new BookingChangeRequest(request).validate();
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new HttpError(400, 'Dữ liệu yêu cầu thay đổi không hợp lệ');
      }
      throw error;
    }
    const before = itinerary(request.before);
    const after = itinerary(request.after);
    if (!isDeepStrictEqual(before, itinerary(booking)))
      throw new HttpError(409, 'Booking đã thay đổi so với lịch cũ. Cần gửi yêu cầu mới');
    if (
      !Number.isFinite(after.pickup_time) ||
      !Number.isFinite(after.estimated_end_time) ||
      after.estimated_end_time <= after.pickup_time ||
      after.pickup_time <= Date.now()
    )
      throw new HttpError(400, 'Thời gian mới không hợp lệ hoặc đã qua');
    if (new Date(booking.pickup_time).getTime() <= Date.now())
      throw new HttpError(409, 'Chuyến đi đã đến giờ khởi hành');
    if (
      !Number.isFinite(after.estimated_price) ||
      after.estimated_price < 0 ||
      request.price_difference !== after.estimated_price - before.estimated_price
    )
      throw new HttpError(400, 'Chênh lệch giá không hợp lệ');
    if (
      new Set(after.trip_stops.map((stop) => stop.stop_order)).size !==
      after.trip_stops.length
    )
      throw new HttpError(400, 'Thứ tự điểm dừng bị trùng');
    const vehicle = await bookingRepository.lockVehicleSchedule(
      booking.vehicle_id,
      session,
    );
    if (!vehicle || !['available', 'in_use'].includes(vehicle.status))
      throw new HttpError(409, 'Xe không đủ điều kiện vận hành');
    const start = new Date(after.pickup_time);
    const end = new Date(after.estimated_end_time);
    if (
      await bookingRepository.findOverlappingVehicleBooking({
        vehicleId: booking.vehicle_id,
        pickupTime: start,
        estimatedEndTime: end,
        excludeBookingId: booking.booking_id,
        session,
      })
    )
      throw new HttpError(409, 'Lịch mới trùng lịch xe');
    if (
      await changeRequestRepository.hasDriverConflict(
        booking.booking_id,
        start,
        end,
        session,
      )
    )
      throw new HttpError(409, 'Lịch mới trùng lịch tài xế đã phân công');
    const updated = await changeRequestRepository.applyItinerary(
      booking.booking_id,
      request.after,
      session,
    );
    if (!updated) throw new HttpError(409, 'Booking đã được xử lý bởi người khác');
    const workflow = await TripWorkflow.findOne({ booking_id: booking.booking_id, stage: 'routed_to_booking_changes' }).session(session);
    if (workflow) {
      workflow.stage = workflow.resume_stage || 'reassignment_required';
      workflow.resume_stage = null;
      workflow.history.push({ action: 'booking_change_approved', actor_id: reviewer, note: 'Đã áp dụng lịch trình được duyệt ở luồng 4', created_at: new Date() });
      workflow.updated_at = new Date();
      await workflow.save({ session });
    }
    const result = await changeRequestRepository.decidePendingRequest(
      requestId,
      'approved',
      reviewer,
      null,
      session,
    );
    if (!result) throw new HttpError(409, 'Yêu cầu đã được xử lý bởi người khác');
    return result;
  });
}

async function rejectChangeRequest(id, input = {}, reviewerId) {
  const requestId = parsePositiveInteger(id, 'change_request_id');
  const reviewer = parsePositiveInteger(reviewerId, 'reviewed_by');
  if (
    typeof input?.rejection_reason !== 'string' ||
    !input.rejection_reason.trim() ||
    input.rejection_reason.trim().length > 2000
  )
    throw new HttpError(400, 'Lý do từ chối phải có từ 1 đến 2000 ký tự');
  const request = await pendingRequest(requestId);
  const result = await changeRequestRepository.decidePendingRequest(
    requestId,
    'rejected',
    reviewer,
    input.rejection_reason.trim(),
  );
  if (!result) throw new HttpError(409, 'Yêu cầu đã được xử lý bởi người khác');
  const workflow = await TripWorkflow.findOne({ booking_id: request.booking_id, stage: 'routed_to_booking_changes' });
  if (workflow) {
    workflow.stage = workflow.resume_stage || 'reassignment_required';
    workflow.resume_stage = null;
    workflow.history.push({ action: 'booking_change_rejected', actor_id: reviewer, note: input.rejection_reason.trim(), created_at: new Date() });
    workflow.updated_at = new Date();
    await workflow.save();
  }
  return result;
}

module.exports = {
  approveChangeRequest,
  rejectChangeRequest,
  getChangeRequests,
  getChangeRequestById,
};
