const express = require('express');
const bookingController = require('../controllers/booking.controller');

const router = express.Router();

// Authentication and Operator authorization will be added with the auth module.
router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);

module.exports = router;
