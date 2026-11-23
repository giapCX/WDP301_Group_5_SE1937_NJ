const { randomInt } = require('node:crypto');
const { BookingChangeRequest, Booking, TripStop, TripAssignment } = require('../models');

const USER_FIELDS = 'user_id full_name email phone -_id';
const BOOKING_FIELDS = [
  'booking_id',
  'renter_id',
  'vehicle_id',
  'pickup_location',
  'dropoff_location',
  'pickup_time',
  'estimated_end_time',
  'estimated_price',
  'additional_charge',
  'booking_status',
  '-_id',
].join(' ');

const LIST_FIELDS = [
  'change_request_id',
  'booking_id',
  'requested_by',
  'requested_at',
  'reason',
  'request_status',
  'price_difference',
  'reviewed_by',
  'reviewed_at',
  '-_id',
].join(' ');

function validateId(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${field} must be a positive integer`);
  }
}

// The service converts HTTP query strings before calling this repository.
async function findChangeRequests({ status, bookingId, page = 1, limit = 10 } = {}) {
  validateId(page, 'page');
  validateId(limit, 'limit');

  if (limit > 10) {
    throw new RangeError('limit must not exceed 10');
  }

  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip)) {
    throw new RangeError('Pagination offset exceeds the safe integer range');
  }

  const filter = {};

  if (status !== undefined) {
    const statuses = BookingChangeRequest.schema.path('request_status').enumValues;

    if (typeof status !== 'string' || !statuses.includes(status)) {
      throw new TypeError('Invalid change request status');
    }

    filter.request_status = status;
  }

  if (bookingId !== undefined) {
    validateId(bookingId, 'bookingId');
    filter.booking_id = bookingId;
  }

  const [items, total] = await Promise.all([
    BookingChangeRequest.find(filter)
      .select(LIST_FIELDS)
      .sort({ requested_at: -1, change_request_id: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'booking',
        select: BOOKING_FIELDS,
      })
      .populate({
        path: 'requester',
        select: USER_FIELDS,
      })
      .lean()
      .exec(),
    BookingChangeRequest.countDocuments(filter).exec(),
  ]);

  return {
    items,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}

// Returns null when the numeric change_request_id does not exist.
async function findChangeRequestById(changeRequestId) {
  validateId(changeRequestId, 'changeRequestId');

  return BookingChangeRequest.findOne({ change_request_id: changeRequestId })
    .select('-_id')
    .populate({
      path: 'booking',
      select: BOOKING_FIELDS,
    })
    .populate({
      path: 'requester',
      select: USER_FIELDS,
    })
    .populate({
      path: 'reviewer',
      select: USER_FIELDS,
    })
    .lean()
    .exec();
}

async function findRequestForReview(id, session = null) {
  return BookingChangeRequest.findOne({ change_request_id: id }).session(session).lean();
}

async function decidePendingRequest(
  id,
  status,
  reviewerId,
  reason = null,
  session = null,
) {
  return BookingChangeRequest.findOneAndUpdate(
    { change_request_id: id, request_status: 'pending' },
    {
      $set: {
        request_status: status,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        rejection_reason: reason,
      },
    },
    { session, returnDocument: 'after', runValidators: true },
  )
    .select('-_id')
    .lean();
}

async function applyItinerary(bookingId, after, session) {
  const { trip_stops: stops, ...fields } = after;
  const updated = await Booking.findOneAndUpdate(
    { booking_id: bookingId, booking_status: 'confirmed' },
    { $set: fields },
    { session, returnDocument: 'after', runValidators: true },
  ).lean();
  if (!updated) return null;
  const existing = await TripStop.find({ booking_id: bookingId }).session(session).lean();
  await TripStop.deleteMany({
    booking_id: bookingId,
    stop_order: { $nin: stops.map((stop) => stop.stop_order) },
  }).session(session);
  for (const stop of stops) {
    const previous = existing.find((item) => item.stop_order === stop.stop_order);
    if (previous) {
      await TripStop.updateOne(
        { stop_id: previous.stop_id },
        { $set: stop },
        { session, runValidators: true },
      );
    } else {
      // Domain IDs are safe integers; uniqueness is enforced by the stop_id index.
      await TripStop.create(
        [{ ...stop, booking_id: bookingId, stop_id: randomInt(1, 2 ** 48 - 1) }],
        { session },
      );
    }
  }
  return updated;
}

async function hasDriverConflict(bookingId, start, end, session) {
  const assignments = await TripAssignment.find({
    booking_id: bookingId,
    assignment_status: 'assigned',
  })
    .session(session)
    .lean();
  if (!assignments.length) return false;
  const others = await TripAssignment.find({
    booking_id: { $ne: bookingId },
    driver_id: { $in: assignments.map((item) => item.driver_id) },
    assignment_status: 'assigned',
  })
    .session(session)
    .lean();
  return Boolean(
    await Booking.exists({
      booking_id: { $in: others.map((item) => item.booking_id) },
      booking_status: { $in: ['confirmed', 'in_progress'] },
      pickup_time: { $lt: end },
      estimated_end_time: { $gt: start },
    }).session(session),
  );
}

async function findPendingForBooking(bookingId, session) {
  return BookingChangeRequest.findOne({
    booking_id: bookingId,
    request_status: 'pending',
  })
    .session(session)
    .lean();
}

async function createChangeRequest(data, session) {
  const [request] = await BookingChangeRequest.create([data], { session });
  const result = request.toObject({ virtuals: false });
  delete result._id;
  return result;
}

async function findRenterHistory({ bookingId, renterId, status, page, limit }) {
  validateId(bookingId, 'bookingId');
  validateId(renterId, 'renterId');
  validateId(page, 'page');
  validateId(limit, 'limit');
  if (limit > 10 || !Number.isSafeInteger((page - 1) * limit)) {
    throw new RangeError('Invalid pagination');
  }
  const filter = { booking_id: bookingId, requested_by: renterId };
  if (status !== undefined) filter.request_status = status;
  const [items, total] = await Promise.all([
    BookingChangeRequest.find(filter)
      .select(
        'change_request_id booking_id requested_at reason before after price_difference request_status reviewed_at rejection_reason -_id',
      )
      .sort({ requested_at: -1, change_request_id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    BookingChangeRequest.countDocuments(filter).exec(),
  ]);
  return { items, total, page, limit, total_pages: Math.ceil(total / limit) };
}

module.exports = {
  findRenterHistory,
  findPendingForBooking,
  createChangeRequest,
  findRequestForReview,
  decidePendingRequest,
  applyItinerary,
  hasDriverConflict,
  findChangeRequests,
  findChangeRequestById,
};
