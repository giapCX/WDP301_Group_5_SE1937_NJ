const mongoose = require('mongoose');
const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');
const { Booking, TripStop, Vehicle } = require('../models');

const standaloneScheduleContext = new AsyncLocalStorage();

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
      .select('-_id -additional_charges')
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
async function findBookingById(bookingId, session = null) {
  if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
    throw new RangeError('bookingId must be a positive integer');
  }

  const booking = await Booking.findOne({ booking_id: bookingId })
    .session(session)
    .select('-_id -additional_charges')
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
    .session(session)
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
  return Vehicle.findOne({ vehicle_id: vehicleId }).select('-_id').lean().exec();
}

// Adjacent trips may share an endpoint; only actual overlap is a conflict.
async function findOverlappingVehicleBooking({
  vehicleId,
  pickupTime,
  estimatedEndTime,
  excludeBookingId,
  session = null,
}) {
  return Booking.findOne({
    booking_id: { $ne: excludeBookingId },
    vehicle_id: vehicleId,
    booking_status: { $in: ['confirmed', 'in_progress'] },
    pickup_time: { $lt: estimatedEndTime },
    estimated_end_time: { $gt: pickupTime },
  })
    .session(session)
    .select('-_id')
    .lean()
    .exec();
}

// The service must validate permissions and availability before calling this.
// Call inside runInTransaction after lockVehicleSchedule for cross-booking safety.
async function approvePendingBooking({ bookingId, vehicleId, reviewedBy, session }) {
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
      session,
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

async function runInTransaction(work) {
  try {
    return await mongoose.connection.transaction(work, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });
  } catch (error) {
    if (!/Transaction numbers are only allowed on a replica set member or mongos/i.test(error.message)) throw error;
    const context = { releases: [], lockedVehicles: new Set() };
    return standaloneScheduleContext.run(context, async () => {
      try {
        return await work(null);
      } finally {
        for (const release of context.releases.reverse()) await release().catch((releaseError) => console.error('Could not release standalone schedule lock:', releaseError.message));
      }
    });
  }
}

// Replica sets serialize this through a transaction write. Standalone MongoDB uses a
// short-lived document lock so existing local Compass databases can still apply changes.
async function lockVehicleSchedule(vehicleId, session) {
  if (session?.inTransaction()) {
    return Vehicle.findOneAndUpdate(
      { vehicle_id: vehicleId },
      { $inc: { schedule_version: 1 } },
      { session, returnDocument: 'after', runValidators: true },
    )
      .lean()
      .exec();
  }
  const context = standaloneScheduleContext.getStore();
  if (!context) throw new Error('A vehicle schedule lock requires a transaction or standalone schedule context');
  if (context.lockedVehicles.has(vehicleId)) return Vehicle.findOne({ vehicle_id: vehicleId }).lean().exec();
  const token = randomUUID();
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const vehicle = await Vehicle.findOneAndUpdate(
    {
      vehicle_id: vehicleId,
      $or: [
        { schedule_lock_token: { $exists: false } },
        { schedule_lock_token: null },
        { schedule_lock_at: { $lt: staleBefore } },
      ],
    },
    { $inc: { schedule_version: 1 }, $set: { schedule_lock_token: token, schedule_lock_at: new Date() } },
    { returnDocument: 'after', runValidators: true },
  ).lean().exec();
  if (!vehicle) throw new Error('Lịch xe đang được cập nhật bởi thao tác khác; vui lòng thử lại');
  context.lockedVehicles.add(vehicleId);
  context.releases.push(() => Vehicle.updateOne(
    { vehicle_id: vehicleId, schedule_lock_token: token },
    { $unset: { schedule_lock_token: '', schedule_lock_at: '' } },
  ).exec());
  return vehicle;
}

// Availability is advisory; approval rechecks it while holding the vehicle schedule lock.
async function findAvailableVehicles({ bookingId, pickupTime, estimatedEndTime }) {
  const statuses =
    pickupTime.getTime() > Date.now() ? ['available', 'in_use'] : ['available'];

  return Vehicle.aggregate([
    {
      $match: {
        status: { $in: statuses },
      },
    },
    {
      $lookup: {
        from: Booking.collection.name,
        let: { vehicleId: '$vehicle_id' },
        pipeline: [
          {
            $match: {
              booking_id: { $ne: bookingId },
              booking_status: { $in: ['confirmed', 'in_progress'] },
              pickup_time: { $lt: estimatedEndTime },
              estimated_end_time: { $gt: pickupTime },
              $expr: { $eq: ['$vehicle_id', '$$vehicleId'] },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'conflicting_bookings',
      },
    },
    {
      $match: {
        'conflicting_bookings.0': { $exists: false },
      },
    },
    { $sort: { vehicle_id: 1 } },
    {
      $project: {
        _id: 0,
        vehicle_id: 1,
        plate_number: 1,
        brand: 1,
        model: 1,
        seat_count: 1,
        price_per_day: 1,
        status: 1,
      },
    },
  ]).exec();
}

module.exports = {
  findAvailableVehicles,
  runInTransaction,
  lockVehicleSchedule,
  findBookings,
  findBookingById,
  findVehicleById,
  findOverlappingVehicleBooking,
  approvePendingBooking,
  rejectPendingBooking,
};
