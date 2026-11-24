const express = require('express');
const requireRenter = require('../middleware/require-renter.middleware');
const reservations = require('../services/renter-reservation.service');
const payments = require('../services/renter-payment.service');
const repository = require('../repositories/renter-reservation.repository');
const { acceptQuote } = require('../services/booking-quote.service');
const { findBookingById } = require('../repositories/booking.repository');
const HttpError = require('../utils/http-error');

const router = express.Router();

router.get('/seat-options', requireRenter, async (_req, res) => {
  res.json({ seats: await repository.findSeatOptions() });
});
router.get('/', requireRenter, async (req, res) => {
  const before = req.query.before === undefined ? null : reservations.positiveId(req.query.before);
  const bookings = await repository.listBookings(req.user.user_id, before);
  const items = bookings.items.map((booking) => ({ ...booking, paymentDue: payments.paymentDue(booking) }));
  res.set('Cache-Control', 'no-store').json({ ...bookings, items, checkoutAvailable: payments.isAvailable() });
});
router.post('/', requireRenter, async (req, res) => {
  const booking = await reservations.create(req.body, req.user.user_id);
  res.status(201).json({ bookingId: booking.booking_id, status: booking.booking_status });
});
router.get('/:id/quote-review', requireRenter, async (req, res) => {
  const booking = await findBookingById(reservations.positiveId(req.params.id));
  if (!booking || booking.renter_id !== req.user.user_id) throw new HttpError(404, 'Không tìm thấy đơn đặt xe.');
  res.set('Cache-Control', 'no-store').json({
    contact: booking.renter, stops: booking.trip_stops,
  });
});
router.post('/:id/accept-quote', requireRenter, async (req, res) => {
  const status = await acceptQuote(reservations.positiveId(req.params.id), req.user.user_id, req.body);
  res.json({ status });
});
router.post('/:id/checkout', requireRenter, async (req, res) => {
  res.json(await payments.checkout(reservations.positiveId(req.params.id), req.user.user_id));
});

module.exports = router;

