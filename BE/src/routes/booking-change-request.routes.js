const express = require('express');
const changeRequestController = require('../controllers/booking-change-request.controller');

const router = express.Router();

// Read endpoints follow existing booking routes; auth integration is pending.
router.get('/', changeRequestController.getChangeRequests);
router.get('/:id', changeRequestController.getChangeRequestById);

module.exports = router;
