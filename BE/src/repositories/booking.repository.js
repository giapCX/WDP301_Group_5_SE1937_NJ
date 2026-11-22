const { Booking, TripStop, Vehicle } = require('../models');

const USER_FIELDS = 'user_id full_name email phone -_id';
const VEHICLE_FIELDS =
  'vehicle_id plate_number brand model seat_count price_per_day status -_id';

/**
 * Read bookings for the Operator list.
 * The service should convert HTTP query strings to numbers before calling this.
 */
async function findBookings({ status, page = 1, limit = 10 } = {}) {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new RangeError('page must be a positive integer');
  }

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError('limit must be an integer between 1 and 100');
  }

  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip)) {
    throw new RangeError('Pagination offset exceeds the safe integer range');
  }

  const filter = {};

  if (status !== undefined) {
    if (typeof status !== 'string' || !status.trim() || status.length > 30) {
      throw new TypeError('status must be a non-empty string up to 30 characters');
    }

    filter.booking_status = status.trim();
  }

  const [items, total] = await Promise.all([
    Booking.find(filter)
      .select('-_id')
      .sort({ created_at: -1, booking_id: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'renter',
        select: USER_FIELDS,
      })
      .populate({
        path: 'vehicle',
        select: VEHICLE_FIELDS,
      })
      .lean()
      .exec(),
    Booking.countDocuments(filter).exec(),
  ]);

  return {
    items,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}

/** Returns null when the numeric booking_id does not exist. */
async function findBookingById(bookingId) {
  if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
    throw new RangeError('bookingId must be a positive integer');
  }

  const booking = await Booking.findOne({ booking_id: bookingId })
    .select('-_id')
    .populate({
      path: 'renter',
      select: USER_FIELDS,
    })
    .populate({
      path: 'vehicle',
      select: VEHICLE_FIELDS,
    })
    .populate({
      path: 'reviewer',
      select: USER_FIELDS,
    })
    .lean()
    .exec();

  if (!booking) {
    return null;
  }

  const tripStops = await TripStop.find({ booking_id: bookingId })
    .select('-_id')
    .sort({ stop_order: 1, stop_id: 1 })
    .lean()
    .exec();

  return {
    ...booking,
    trip_stops: tripStops,
  };
}

async function findVehicleById(vehicleId) {
  return Vehicle.findOne({ vehicle_id: vehicleId })
    .select('-_id')
    .lean()
    .exec();
}

// Adjacent trips may share an endpoint; only actual overlap is a conflict.
async function findOverlappingVehicleBooking({
  vehicleId,
  pickupTime,
  estimatedEndTime,
  excludeBookingId,
}) {
  return Booking.findOne({
    booking_id: { $ne: excludeBookingId },
    vehicle_id: vehicleId,
    booking_status: { $in: ['confirmed', 'in_progress'] },
    pickup_time: { $lt: estimatedEndTime },
    estimated_end_time: { $gt: pickupTime },
  })
    .select('-_id')
    .lean()
    .exec();
}

// The service must validate permissions and availability before calling this.
// This condition prevents two decisions on the SAME booking; it does not lock
// the vehicle across different bookings being approved concurrently.
async function approvePendingBooking({ bookingId, vehicleId, reviewedBy }) {
  return Booking.findOneAndUpdate(
    {
      booking_id: bookingId,
      booking_status: 'pending',
    },
    {
      $set: {
        vehicle_id: vehicleId,
        booking_status: 'confirmed',
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        rejection_reason: null,
      },
    },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  )
    .select('-_id')
    .lean()
    .exec();
}

async function rejectPendingBooking({ bookingId, reviewedBy, rejectionReason }) {
  return Booking.findOneAndUpdate(
    {
      booking_id: bookingId,
      booking_status: 'pending',
    },
    {
      $set: {
        booking_status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        rejection_reason: rejectionReason,
      },
    },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  )
    .select('-_id')
    .lean()
    .exec();
}

module.exports = {
  findBookings,
  findBookingById,
  findVehicleById,
  findOverlappingVehicleBooking,
  approvePendingBooking,
  rejectPendingBooking,
};
