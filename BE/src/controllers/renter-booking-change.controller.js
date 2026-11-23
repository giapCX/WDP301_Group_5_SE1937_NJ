const service = require('../services/renter-booking-change.service');

async function createChangeRequest(req, res, next) {
  try {
    const request = await service.createChangeRequest(
      req.params.id,
      req.body,
      req.user.user_id,
    );
    return res.status(201).json({ success: true, data: request });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createChangeRequest };
