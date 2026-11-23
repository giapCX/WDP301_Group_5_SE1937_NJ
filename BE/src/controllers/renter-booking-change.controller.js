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

async function getChangeRequestHistory(req, res, next) {
  try {
    const result = await service.getChangeRequestHistory(
      req.params.id,
      req.query,
      req.user.user_id,
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createChangeRequest, getChangeRequestHistory };
