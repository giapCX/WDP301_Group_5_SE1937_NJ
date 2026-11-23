const express = require('express');
const controller = require('../controllers/renter-booking-change.controller');
const requireRenter = require('../middleware/require-renter.middleware');

const router = express.Router();
router.get('/:id/change-requests', requireRenter, controller.getChangeRequestHistory);
router.post('/:id/change-requests', requireRenter, controller.createChangeRequest);
module.exports = router;
