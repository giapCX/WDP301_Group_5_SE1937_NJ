const express = require('express');
const bookingController = require('../controllers/booking.controller');
const requireOperator = require('../middleware/require-operator.middleware');
const { sendQuote, closeTrip, previewQuote } = require('../services/booking-quote.service');
const { positiveId } = require('../services/renter-reservation.service');

const { rates } = require('../services/quote-calculator');
const router = express.Router();

router.post('/:id/quote-preview', requireOperator, async (req, res) => {
  const data = await previewQuote(positiveId(req.params.id), req.body);
  res.json({ success: true, data });
});
router.get('/quote-rates', requireOperator, (req, res) => res.json({ success: true, data: rates }));

router.get('/', requireOperator, bookingController.getBookings);
router.get('/:id/available-vehicles', requireOperator, bookingController.getAvailableVehicles);
router.get('/:id', requireOperator, bookingController.getBookingById);
router.patch('/:id/quote', requireOperator, async (req, res) => {
  const data = await sendQuote(positiveId(req.params.id), req.body, req.user.user_id);
  res.json({ success: true, data });
});
router.patch('/:id/complete', requireOperator, async (req, res) => {
  const data = await closeTrip(positiveId(req.params.id));
  res.json({ success: true, data });
});
router.patch('/:id/approve', requireOperator, bookingController.approveBooking);
router.patch('/:id/reject', requireOperator, bookingController.rejectBooking);

module.exports = router;
