const mongoose = require('mongoose');
const {
  ACTIVE_BOOKING_STATUSES,
  CLOSED_BOOKING_STATUSES,
  CLOSED_INCIDENT_STATUSES,
  CLOSED_MAINTENANCE_STATUSES,
  MAX_ALERTS,
  PAID_PAYMENT_STATUSES,
} = require('../config/manager-dashboard.constants');

function normalizeStatus(document) {
  return document.operational_status || document.status || document.approval_status || 'unknown';
}

function createMonthRange(year, month) {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isActiveBooking(booking) {
  const status = booking.status || booking.booking_status;
  if (!ACTIVE_BOOKING_STATUSES.has(status)) return false;
  if (status === 'confirmed') {
    const endAt = booking.end_at || booking.estimated_end_time;
    return Boolean(endAt && new Date(endAt) >= new Date());
  }
  return true;
}

function buildWeeklyTrend(year, month, bookings, payments) {
  const lastDay = new Date(year, month, 0).getDate();
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const startDay = index * 7 + 1;
    const endDay = Math.min(startDay + 6, lastDay);
    return { key: `week-${index + 1}`, label: `Tuần ${index + 1} (${String(startDay).padStart(2, '0')}-${String(endDay).padStart(2, '0')})`, bookings: 0, revenue: 0 };
  });
  const weekFor = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1) return null;
    return weeks[Math.min(3, Math.floor((date.getDate() - 1) / 7))];
  };
  for (const booking of bookings) {
    if (CLOSED_BOOKING_STATUSES.has(booking.status || booking.booking_status)) continue;
    const week = weekFor(booking.pickup_time || booking.start_at);
    if (week) week.bookings += 1;
  }
  for (const payment of payments) {
    if (!PAID_PAYMENT_STATUSES.has(payment.payment_status || payment.status)) continue;
    const week = weekFor(payment.paid_at);
    if (week) week.revenue += Number(payment.amount || 0);
  }
  return weeks;
}

function buildFleetRows({ vehicles, activeBookings, assignments, drivers, users }) {
  const profilesByDriver = new Map(drivers.map((driver) => [driver.driver_id, driver]));
  const usersById = new Map(users.map((user) => [user.user_id, user]));
  const assignmentsByBooking = new Map();
  for (const assignment of assignments) {
    const current = assignmentsByBooking.get(assignment.booking_id);
    if (!current || new Date(assignment.assigned_at || 0) > new Date(current.assigned_at || 0)) {
      assignmentsByBooking.set(assignment.booking_id, assignment);
    }
  }
  const bookingsByVehicle = new Map();
  for (const booking of activeBookings) {
    if (!booking.vehicle_id) continue;
    const current = bookingsByVehicle.get(booking.vehicle_id);
    if (!current || new Date(booking.pickup_time || 0) < new Date(current.pickup_time || 0)) {
      bookingsByVehicle.set(booking.vehicle_id, booking);
    }
  }

  return vehicles.map((vehicle) => {
    const booking = bookingsByVehicle.get(vehicle.vehicle_id) || null;
    const assignment = booking ? assignmentsByBooking.get(booking.booking_id) : null;
    const driver = assignment ? profilesByDriver.get(assignment.driver_id) : null;
    const renter = booking ? usersById.get(booking.renter_id) : null;
    const driverUser = driver ? usersById.get(driver.user_id) : null;
    return {
      id: vehicle.vehicle_id ?? String(vehicle._id),
      plateNumber: vehicle.plate_number || '—',
      name: [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Xe chưa đặt tên',
      brand: vehicle.brand || null,
      model: vehicle.model || null,
      year: vehicle.year ?? vehicle.vehicle_year ?? null,
      category: vehicle.vehicle_type || null,
      seats: vehicle.seats || vehicle.seat_count || null,
      dailyPrice: vehicle.base_price_per_day ?? vehicle.price_per_day ?? null,
      status: normalizeStatus(vehicle),
      approvalStatus: vehicle.approval_status || null,
      image: Array.isArray(vehicle.photos) ? vehicle.photos[0] : null,
      odometer: vehicle.odometer_km ?? vehicle.odometer ?? null,
      booking: booking ? {
        id: booking.booking_id,
        status: booking.status || booking.booking_status,
        renterName: renter?.full_name || null,
        startAt: booking.start_at || booking.pickup_time || null,
        endAt: booking.end_at || booking.estimated_end_time || null,
      } : null,
      driver: driverUser?.full_name || null,
    };
  });
}

function latestAssignmentsByBooking(assignments) {
  const latest = new Map();
  for (const assignment of assignments) {
    const current = latest.get(assignment.booking_id);
    if (!current || new Date(assignment.assigned_at || 0) > new Date(current.assigned_at || 0)) {
      latest.set(assignment.booking_id, assignment);
    }
  }
  return latest;
}

function buildDriverRows({ drivers, users, assignments, reviews }) {
  const usersById = new Map(users.map((user) => [user.user_id, user]));
  const reviewsByBooking = new Map(reviews.map((review) => [review.booking_id, review]));
  const assignmentsByBooking = latestAssignmentsByBooking(assignments);
  const totalsByDriver = new Map();

  for (const assignment of assignmentsByBooking.values()) {
    const status = String(assignment.assignment_status || '').toLowerCase();
    if (['rejected', 'cancelled', 'canceled'].includes(status)) continue;
    const totals = totalsByDriver.get(assignment.driver_id) || {
      tripCount: 0,
      completedTripCount: 0,
      activeTripCount: 0,
      ratingTotal: 0,
      reviewCount: 0,
    };
    totals.tripCount += 1;
    if (status === 'completed') totals.completedTripCount += 1;
    if (['assigned', 'active', 'in_progress', 'ongoing'].includes(status)) totals.activeTripCount += 1;
    const rating = Number(reviewsByBooking.get(assignment.booking_id)?.driver_rating);
    if (Number.isFinite(rating) && rating > 0) {
      totals.ratingTotal += rating;
      totals.reviewCount += 1;
    }
    totalsByDriver.set(assignment.driver_id, totals);
  }

  return drivers.map((driver) => {
    const totals = totalsByDriver.get(driver.driver_id) || {
      tripCount: 0,
      completedTripCount: 0,
      activeTripCount: 0,
      ratingTotal: 0,
      reviewCount: 0,
    };
    return {
      id: driver.driver_id,
      name: usersById.get(driver.user_id)?.full_name || null,
      availability: driver.availability_status || 'unknown',
      licenseExpiry: driver.license_expiry || null,
      tripCount: totals.tripCount,
      completedTripCount: totals.completedTripCount,
      activeTripCount: totals.activeTripCount,
      rating: totals.reviewCount ? Math.round((totals.ratingTotal / totals.reviewCount) * 100) / 100 : null,
      reviewCount: totals.reviewCount,
      completionRate: totals.tripCount ? Math.round((totals.completedTripCount / totals.tripCount) * 1000) / 10 : 0,
    };
  });
}

function buildAlerts(maintenance, incidents) {
  const alertItems = [
    ...maintenance.map((record) => ({
      id: `maintenance-${record.maintenance_id}`,
      type: 'maintenance',
      title: record.description,
      status: record.maintenance_status,
      createdAt: record.started_at || null,
      vehicleId: record.vehicle_id,
    })),
    ...incidents.map((incident) => ({
      id: `incident-${incident.incident_id}`,
      type: 'incident',
      title: incident.description,
      status: incident.incident_status,
      createdAt: incident.created_at || null,
      bookingId: incident.booking_id,
    })),
  ];
  return alertItems.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)).slice(0, MAX_ALERTS);
}

async function findManagerDashboard({ year, month, vehicleStatus, search } = {}) {
  const db = mongoose.connection.db;
  const now = new Date();
  const selectedYear = Number.isInteger(year) ? year : now.getFullYear();
  const selectedMonth = Number.isInteger(month) ? month : now.getMonth() + 1;
  const range = createMonthRange(selectedYear, selectedMonth);
  const [vehicles, vehicleSummary, periodBookings, periodPayments, allActiveBookings, drivers, openMaintenance, openIncidents, pendingBookings, assignments, completedRefunds] = await Promise.all([
    db.collection('vehicles').find({}, { projection: {
      vehicle_id: 1, plate_number: 1, brand: 1, model: 1, year: 1, vehicle_year: 1, vehicle_type: 1, seats: 1, seat_count: 1, photos: 1,
      base_price_per_day: 1, price_per_day: 1, odometer_km: 1, odometer: 1, status: 1, operational_status: 1, approval_status: 1,
    } }).sort({ vehicle_id: 1, _id: 1 }).toArray(),
    db.collection('vehicles').aggregate([
      { $facet: {
        totals: [{ $group: {
          _id: null,
          count: { $sum: 1 },
          available: { $sum: { $cond: [{ $and: [
            { $eq: [{ $ifNull: ['$operational_status', '$status'] }, 'available'] },
            { $eq: [{ $ifNull: ['$approval_status', 'approved'] }, 'approved'] },
          ] }, 1, 0] } },
        } }],
        statuses: [
          { $group: { _id: { $ifNull: ['$operational_status', { $ifNull: ['$status', 'unknown'] }] }, count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } },
        ],
      } },
    ]).toArray(),
    db.collection('bookings').find({ $or: [
      { pickup_time: { $gte: range.start, $lt: range.end } },
      { start_at: { $gte: range.start, $lt: range.end } },
    ] }, { projection: {
      booking_id: 1, vehicle_id: 1, renter_id: 1, status: 1, booking_status: 1,
      pickup_time: 1, estimated_end_time: 1, start_at: 1, end_at: 1,
    } }).toArray(),
    db.collection('payments').find({ $or: [
      { paid_at: { $gte: range.start, $lt: range.end }, payment_status: { $in: [...PAID_PAYMENT_STATUSES] } },
      { paid_at: { $gte: range.start, $lt: range.end }, status: { $in: [...PAID_PAYMENT_STATUSES] } },
    ] }, { projection: { payment_id: 1, booking_id: 1, amount: 1, paid_at: 1, payment_status: 1, status: 1 } }).toArray(),
    db.collection('bookings').find({ $or: [
      { booking_status: { $in: [...ACTIVE_BOOKING_STATUSES] } },
      { status: { $in: [...ACTIVE_BOOKING_STATUSES] } },
    ] }, { projection: { booking_id: 1, vehicle_id: 1, renter_id: 1, booking_status: 1, status: 1, pickup_time: 1, start_at: 1, estimated_end_time: 1, end_at: 1 } }).toArray(),
    db.collection('driver_profiles').find({}, { projection: { driver_id: 1, user_id: 1, availability_status: 1, approved_at: 1, license_expiry: 1 } }).toArray(),
    db.collection('maintenance_records').find({ maintenance_status: { $nin: [...CLOSED_MAINTENANCE_STATUSES] } }, { projection: { maintenance_id: 1, vehicle_id: 1, description: 1, maintenance_status: 1, started_at: 1 } }).sort({ started_at: -1, maintenance_id: -1 }).limit(MAX_ALERTS).toArray(),
    db.collection('incidents').find({ incident_status: { $nin: [...CLOSED_INCIDENT_STATUSES] } }, { projection: { incident_id: 1, booking_id: 1, description: 1, incident_status: 1, created_at: 1 } }).sort({ created_at: -1, incident_id: -1 }).limit(MAX_ALERTS).toArray(),
    db.collection('bookings').find({ $or: [{ booking_status: 'pending' }, { status: 'pending' }] }, { projection: {
      booking_id: 1, renter_id: 1, vehicle_id: 1, requested_seat_count: 1, pickup_time: 1,
      estimated_price: 1, created_at: 1, booking_status: 1, status: 1,
    } }).sort({ created_at: -1, booking_id: -1 }).limit(100).toArray(),
    db.collection('trip_assignments').find({}, { projection: {
      booking_id: 1, driver_id: 1, assignment_status: 1, assigned_at: 1,
    } }).toArray(),
    db.collection('refunds').find({ refund_status: 'completed' }, { projection: {
      refund_id: 1, amount: 1, refund_status: 1,
    } }).toArray(),
  ]);

  const activeBookings = allActiveBookings.filter(isActiveBooking);
  const assignmentBookingIds = [...new Set(assignments.map((assignment) => assignment.booking_id).filter(Number.isSafeInteger))];
  const reviews = assignmentBookingIds.length ? await db.collection('reviews').find({ booking_id: { $in: assignmentBookingIds } }, { projection: { booking_id: 1, driver_rating: 1 } }).toArray() : [];
  const userIds = new Set([
    ...drivers.map((driver) => driver.user_id),
    ...activeBookings.map((booking) => booking.renter_id),
    ...pendingBookings.map((booking) => booking.renter_id),
  ].filter(Number.isSafeInteger));
  const users = userIds.size ? await db.collection('users').find({ user_id: { $in: [...userIds] } }, { projection: { user_id: 1, full_name: 1 } }).toArray() : [];

  let fleet = buildFleetRows({ vehicles, activeBookings, assignments, drivers, users });
  if (vehicleStatus) fleet = fleet.filter((vehicle) => vehicleStatus === 'in_use'
    ? ['in_use', 'ongoing'].includes(vehicle.status)
    : vehicle.status === vehicleStatus);
  if (search) {
    const matcher = new RegExp(escapeRegex(search), 'i');
    fleet = fleet.filter((vehicle) => matcher.test(`${vehicle.plateNumber} ${vehicle.name} ${vehicle.booking?.renterName || ''} ${vehicle.driver || ''}`));
  }

  const vehicleTotals = vehicleSummary[0]?.totals[0] || { count: 0, available: 0 };
  const usersById = new Map(users.map((user) => [user.user_id, user]));
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.vehicle_id, vehicle]));
  const driverRows = buildDriverRows({ drivers, users, assignments, reviews });
  const pendingBookingRows = pendingBookings.map((booking) => {
    const vehicle = vehiclesById.get(booking.vehicle_id);
    return {
      id: booking.booking_id,
      renterName: usersById.get(booking.renter_id)?.full_name || null,
      vehicleName: [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ') || null,
      plateNumber: vehicle?.plate_number || null,
      requestedSeatCount: booking.requested_seat_count ?? null,
      pickupAt: booking.pickup_time || null,
      estimatedPrice: Number(booking.estimated_price) || 0,
      createdAt: booking.created_at || null,
      status: booking.status || booking.booking_status || 'pending',
    };
  });
  const runningCount = (vehicleSummary[0]?.statuses || [])
    .filter(({ _id }) => ['in_use', 'ongoing'].includes(_id))
    .reduce((total, item) => total + item.count, 0);
  const availableVehicles = vehicleTotals.available;
  const revenue = periodPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const paidPaymentCount = periodPayments.length;
  const validRatings = reviews.map((review) => Number(review.driver_rating)).filter((rating) => Number.isFinite(rating) && rating > 0);
  const averageDriverRating = validRatings.length
    ? Math.round((validRatings.reduce((total, rating) => total + rating, 0) / validRatings.length) * 100) / 100
    : null;
  const activeDriverCount = driverRows.filter((driver) => ['busy', 'on_trip', 'in_use', 'ongoing'].includes(String(driver.availability).toLowerCase())).length;
  const driverTripCount = driverRows.reduce((total, driver) => total + driver.tripCount, 0);
  const completedDriverTripCount = driverRows.reduce((total, driver) => total + driver.completedTripCount, 0);
  const revenueTrend = buildWeeklyTrend(selectedYear, selectedMonth, periodBookings, periodPayments);
  const fleetStatus = (vehicleSummary[0]?.statuses || []).map(({ _id, count }) => ({ status: _id || 'unknown', count }));

  return {
    period: { year: selectedYear, month: selectedMonth },
    metrics: {
      vehicleCount: vehicleTotals.count,
      availableCount: availableVehicles,
      availabilityRate: vehicleTotals.count ? Math.round((availableVehicles / vehicleTotals.count) * 1000) / 10 : 0,
      runningCount,
      utilizationRate: vehicleTotals.count ? Math.round((runningCount / vehicleTotals.count) * 1000) / 10 : 0,
      revenue,
      paidPaymentCount,
      bookingCount: periodBookings.filter((booking) => !CLOSED_BOOKING_STATUSES.has(booking.status || booking.booking_status)).length,
      activeBookingCount: activeBookings.length,
      driverCount: drivers.length,
      availableDriverCount: driverRows.filter((driver) => String(driver.availability).toLowerCase() === 'available').length,
      activeDriverCount,
      driverTripCount,
      completedDriverTripCount,
      driverCompletionRate: driverTripCount ? Math.round((completedDriverTripCount / driverTripCount) * 1000) / 10 : 0,
      averageDriverRating,
    },
    revenueTrend,
    fleetStatus,
    vehicles: fleet,
    drivers: driverRows,
    pendingBookings: pendingBookingRows,
    financials: {
      completedRefundCount: completedRefunds.length,
      completedRefundAmount: completedRefunds.reduce((total, refund) => total + Number(refund.amount || 0), 0),
      refundPeriod: 'all_time',
    },
    pendingApprovals: vehicles.filter((vehicle) => ['pending', 'pending_review'].includes(vehicle.approval_status || vehicle.status)),
    alerts: buildAlerts(openMaintenance, openIncidents),
    totalVehicles: vehicleTotals.count,
  };
}

module.exports = { findManagerDashboard };
