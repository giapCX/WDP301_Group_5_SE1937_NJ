const { BookingChangeRequest } = require('../models');

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

module.exports = {
  findChangeRequests,
  findChangeRequestById,
};
