const bookingService = require('../services/booking.service');

async function getBookings(req, res, next) {
  try {
    const result = await bookingService.getBookings(req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getBookingById(req, res, next) {
  try {
    const booking = await bookingService.getBookingById(req.params.id);

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getBookings,
  getBookingById,
};
