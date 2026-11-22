const express = require('express');
const bookingController = require('../controllers/booking.controller');
const requireOperator = require('../middleware/require-operator.middleware');

const router = express.Router();

// Authentication and Operator authorization will be added with the auth module.
router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);
router.patch('/:id/approve', requireOperator, bookingController.approveBooking);
router.patch('/:id/reject', requireOperator, bookingController.rejectBooking);

module.exports = router;
