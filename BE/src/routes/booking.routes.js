const express = require('express');
const bookingController = require('../controllers/booking.controller');
const requireOperator = require('../middleware/require-operator.middleware');
const { requireRolePermission } = require('../middleware/require-management-role.middleware');
const { sendQuote, closeTrip, previewQuote } = require('../services/booking-quote.service');
const { positiveId } = require('../services/renter-reservation.service');

const pricingRules = require('../repositories/pricing-rule.repository');
const HttpError = require('../utils/http-error');
const { Booking } = require('../models');
const router = express.Router();
router.use(requireOperator);

router.post('/:id/quote-preview', requireRolePermission('booking.review'), async (req, res) => {
  const data = await previewQuote(positiveId(req.params.id), req.body);
  res.json({ success: true, data });
});
router.get('/quote-pricing/:bookingId', requireRolePermission('booking.read.all'), async (req, res) => {
  const booking = await Booking.findOne({ booking_id: positiveId(req.params.bookingId) }).lean();
    if (!booking) throw new HttpError(404, 'Không tìm thấy booking.');
  const data = await pricingRules.findActive(booking);
  res.set('Cache-Control', 'no-store').json({ success: true, data });
});
router.get('/contract-company', requireRolePermission('booking.read.all'), async (_req, res) => {
  const data = await require('../services/contract-company.service').contractCompany();
  res.set('Cache-Control', 'no-store').json({ success: true, data });
});

router.get('/', requireRolePermission('booking.read.all'), bookingController.getBookings);
router.get('/:id/available-vehicles', requireRolePermission('booking.read.all'), bookingController.getAvailableVehicles);
router.get('/:id', requireRolePermission('booking.read.all'), bookingController.getBookingById);
router.patch('/:id/quote', requireRolePermission('booking.review'), async (req, res) => {
  const data = await sendQuote(positiveId(req.params.id), req.body, req.user.user_id);
  res.json({ success: true, data });
});
router.patch('/:id/complete', requireRolePermission('booking.review'), async (req, res) => {
  const data = await closeTrip(positiveId(req.params.id));
  res.json({ success: true, data });
});
router.patch('/:id/approve', requireRolePermission('booking.review'), bookingController.approveBooking);
router.patch('/:id/reject', requireRolePermission('booking.review'), bookingController.rejectBooking);

module.exports = router;
