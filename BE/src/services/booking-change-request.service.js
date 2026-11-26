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

const { snapshot: itinerary, validateTimes, validateActiveChange } = require('../utils/itinerary-snapshot');

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
    if (!['confirmed', 'in_progress'].includes(booking.booking_status))
      throw new HttpError(409, 'Chỉ đổi lịch booking đã xác nhận và chưa khởi hành');
    if (booking.cancellation?.status === 'pending') throw new HttpError(409, 'Đơn đang chờ xử lý hủy');
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
    if (request.price_offer && !request.price_offer.accepted_at) throw new HttpError(409, 'Khách cần chấp nhận giá thay đổi trước khi duyệt');
    validateTimes(request.after, booking.service_type);
    await validateActiveChange(booking, request.after, session);
    const before = itinerary(request.before);
    const after = itinerary(request.after);
    if (!isDeepStrictEqual(before, itinerary(booking)))
      throw new HttpError(409, 'Booking đã thay đổi so với lịch cũ. Cần gửi yêu cầu mới');
    if (
      !Number.isFinite(+after.pickup_time) ||
      !Number.isFinite(+after.estimated_end_time) ||
      after.estimated_end_time <= after.pickup_time ||
      (booking.booking_status !== 'in_progress' && after.pickup_time <= Date.now())
    )
      throw new HttpError(400, 'Thời gian mới không hợp lệ hoặc đã qua');
    if (booking.booking_status !== 'in_progress' && new Date(booking.pickup_time).getTime() <= Date.now())
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
    if (booking.quote_offer?.accepted_at) {
      const surcharge = booking.pricing_breakdown.surcharge || 0;
      const newSubtotal = request.after.estimated_price;
      const total = newSubtotal + surcharge;
      const Booking = require('../models').Booking;
      await Booking.updateOne({ booking_id: booking.booking_id }, { $set: { pricing_breakdown: { subtotal: newSubtotal, surcharge, total } },
        $push: { operation_events: { action: 'change_approved', actor_id: reviewer, at: new Date(), note: 'Đã áp dụng lịch trình và giá được chấp nhận' } } }, { session });
      if ((booking.paid_total || 0) - (booking.refunded_total || 0) > total) {
        await require('./cancellation.service').reserveRefunds(booking, booking.paid_total - (booking.refunded_total || 0) - total,
          'Hoàn chênh lệch đổi lịch', 'change:' + requestId, { user_id: reviewer }, session);
      }
    }
    const workflow = await TripWorkflow.findOne({ booking_id: booking.booking_id }).session(session);
    if (workflow) {
      if (workflow.stage === 'routed_to_booking_changes') { workflow.stage = workflow.resume_stage || 'reassignment_required'; workflow.resume_stage = null; }
      if (request.after.return_pickup_time) workflow.return_pickup_time = request.after.return_pickup_time;
      if (request.after.return_pickup_location) workflow.return_pickup_location = request.after.return_pickup_location;
      workflow.return_dropoff_location = request.after.dropoff_location;
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
  return bookingRepository.runInTransaction(async (session) => {
  const request = await pendingRequest(requestId, session);
  const result = await changeRequestRepository.decidePendingRequest(
    requestId,
    'rejected',
    reviewer,
    input.rejection_reason.trim(),
    session,
  );
  if (!result) throw new HttpError(409, 'Yêu cầu đã được xử lý bởi người khác');
  const workflow = await TripWorkflow.findOne({ booking_id: request.booking_id, stage: 'routed_to_booking_changes' }).session(session);
  if (workflow) {
    workflow.stage = workflow.resume_stage || 'reassignment_required';
    workflow.resume_stage = null;
    workflow.history.push({ action: 'booking_change_rejected', actor_id: reviewer, note: input.rejection_reason.trim(), created_at: new Date() });
    workflow.updated_at = new Date();
    await workflow.save({ session });
  }
  await require('../models').Booking.updateOne({ booking_id: request.booking_id }, { $push: { operation_events: { action: 'change_rejected', actor_id: reviewer, at: new Date(), note: input.rejection_reason.trim() } } }, { session });
  return result;
  });
}

async function offerChangePrice(id, input, actorId) {
  const { randomUUID } = require('node:crypto');
  const value = require('./operation-validation').amount(input.price);
  const reason = require('./operation-validation').text(input.reason);
  return bookingRepository.runInTransaction(async (session) => {
    const request = await pendingRequest(parsePositiveInteger(id, 'change_request_id'), session);
    request.after.estimated_price = value;
    request.price_difference = value - request.before.estimated_price;
    const updated = await BookingChangeRequest.findOneAndUpdate({ change_request_id: request.change_request_id, request_status: 'pending' },
      { $set: { after: request.after, price_difference: request.price_difference, price_offer: { id: randomUUID(), sent_by: actorId, sent_at: new Date(), reason } } }, { session, returnDocument: 'after', runValidators: true }).lean();
    await require('../models').Booking.updateOne({ booking_id: request.booking_id }, { $push: { operation_events: { action: 'change_price_offered', actor_id: actorId, at: new Date(), note: reason } } }, { session });
    return updated;
  });
}
async function acceptChangePrice(id, input, renterId) {
  return bookingRepository.runInTransaction(async (session) => {
    const request = await pendingRequest(parsePositiveInteger(id, 'change_request_id'), session);
    if (request.requested_by !== renterId) throw new HttpError(404, 'Không tìm thấy yêu cầu');
    if (!request.price_offer || request.price_offer.id !== input.offerId) throw new HttpError(409, 'Báo giá thay đổi đã cập nhật');
    return BookingChangeRequest.findOneAndUpdate({ change_request_id: request.change_request_id, request_status: 'pending', 'price_offer.id': input.offerId }, { $set: { 'price_offer.accepted_at': new Date() } }, { session, returnDocument: 'after' }).lean();
  });
}
module.exports = { offerChangePrice, acceptChangePrice,
  approveChangeRequest,
  rejectChangeRequest,
  getChangeRequests,
  getChangeRequestById,
};
