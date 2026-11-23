const changeRequestService = require('../services/booking-change-request.service');

async function getChangeRequests(req, res, next) {
  try {
    const result = await changeRequestService.getChangeRequests(req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getChangeRequestById(req, res, next) {
  try {
    const request = await changeRequestService.getChangeRequestById(req.params.id);

    return res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    return next(error);
  }
}

async function approveChangeRequest(req, res, next) {
  try {
    const result = await changeRequestService.approveChangeRequest(
      req.params.id,
      req.user.user_id,
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

async function rejectChangeRequest(req, res, next) {
  try {
    const result = await changeRequestService.rejectChangeRequest(
      req.params.id,
      req.body,
      req.user.user_id,
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  approveChangeRequest,
  rejectChangeRequest,
  getChangeRequests,
  getChangeRequestById,
};
