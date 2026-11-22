const express = require('express');
const changeRequestController = require('../controllers/booking-change-request.controller');

const requireOperator = require('../middleware/require-operator.middleware');

const router = express.Router();

// Read endpoints follow existing booking routes; auth integration is pending.
router.get('/', changeRequestController.getChangeRequests);
router.get('/:id', changeRequestController.getChangeRequestById);

router.patch(
  '/:id/approve',
  requireOperator,
  changeRequestController.approveChangeRequest,
);
router.patch('/:id/reject', requireOperator, changeRequestController.rejectChangeRequest);

module.exports = router;
