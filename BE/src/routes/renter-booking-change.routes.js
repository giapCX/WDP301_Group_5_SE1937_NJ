const express = require('express');
const controller = require('../controllers/renter-booking-change.controller');
const requireRenter = require('../middleware/require-renter.middleware');
const { requireRolePermission } = require('../middleware/require-management-role.middleware');

const router = express.Router();
router.use(requireRenter, requireRolePermission('booking.read.own'));
router.get('/:id/change-requests', controller.getChangeRequestHistory);
router.post('/:id/change-requests', controller.createChangeRequest);
router.post('/change-requests/:id/accept-price', async (req, res) => res.json({ success: true, data: await require('../services/booking-change-request.service').acceptChangePrice(req.params.id, req.body, req.user.user_id) }));
module.exports = router;
