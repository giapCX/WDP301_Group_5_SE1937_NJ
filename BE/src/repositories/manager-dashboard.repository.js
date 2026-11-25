const mongoose = require('mongoose');
const { CLOSED_BOOKING_STATUSES, PAID_PAYMENT_STATUSES } = require('../config/manager-dashboard.constants');

function monthRange(year, month) {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

function createWeeklyTrend(year, month, bookings, payments) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = Array.from({ length: Math.ceil(daysInMonth / 7) }, (_, index) => {
    const firstDay = index * 7 + 1;
    const lastDay = Math.min(firstDay + 6, daysInMonth);
    return {
      key: `week-${index + 1}`,
      label: `Tuần ${index + 1} (${String(firstDay).padStart(2, '0')}-${String(lastDay).padStart(2, '0')})`,
      bookings: 0,
      revenue: 0,
    };
  });
  const findWeek = (value) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1) return null;
    return weeks[Math.floor((date.getDate() - 1) / 7)];
  };

  for (const booking of bookings) {
    if (CLOSED_BOOKING_STATUSES.has(booking.status || booking.booking_status)) continue;
    const week = findWeek(booking.pickup_time || booking.start_at || booking.created_at);
    if (week) week.bookings += 1;
  }
  for (const payment of payments) {
    if (!PAID_PAYMENT_STATUSES.has(payment.payment_status || payment.status)) continue;
    const week = findWeek(payment.paid_at);
    if (week) week.revenue += Number(payment.amount || 0);
  }
  return weeks;
}

async function findManagerDashboard({ year, month } = {}) {
  const now = new Date();
  const selectedYear = Number.isInteger(year) ? year : now.getFullYear();
  const selectedMonth = Number.isInteger(month) ? month : now.getMonth() + 1;
  const range = monthRange(selectedYear, selectedMonth);
  const db = mongoose.connection.db;
  const [bookings, payments, completedRefunds] = await Promise.all([
    db.collection('bookings').find({ $or: [
      { pickup_time: { $gte: range.start, $lt: range.end } },
      { start_at: { $gte: range.start, $lt: range.end } },
      { created_at: { $gte: range.start, $lt: range.end } },
    ] }, { projection: { booking_id: 1, status: 1, booking_status: 1, pickup_time: 1, start_at: 1, created_at: 1 } }).toArray(),
    db.collection('payments').find({ paid_at: { $gte: range.start, $lt: range.end } }, {
      projection: { payment_id: 1, amount: 1, paid_at: 1, payment_status: 1, status: 1 },
    }).toArray(),
    db.collection('refunds').find({ refund_status: 'completed' }, {
      projection: { refund_id: 1, amount: 1 },
    }).toArray(),
  ]);
  const paidPayments = payments.filter((payment) => PAID_PAYMENT_STATUSES.has(payment.payment_status || payment.status));
  const revenue = paidPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);

  return {
    period: { year: selectedYear, month: selectedMonth },
    metrics: {
      revenue,
      paidPaymentCount: paidPayments.length,
      bookingCount: bookings.filter((booking) => !CLOSED_BOOKING_STATUSES.has(booking.status || booking.booking_status)).length,
    },
    revenueTrend: createWeeklyTrend(selectedYear, selectedMonth, bookings, paidPayments),
    financials: {
      completedRefundCount: completedRefunds.length,
      completedRefundAmount: completedRefunds.reduce((total, refund) => total + Number(refund.amount || 0), 0),
      refundPeriod: 'all_time',
    },
  };
}

module.exports = { findManagerDashboard };
