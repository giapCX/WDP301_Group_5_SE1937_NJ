const express = require('express');
const changeRequestController = require('../controllers/booking-change-request.controller');

const requireOperator = require('../middleware/require-operator.middleware');
const { requireRolePermission } = require('../middleware/require-management-role.middleware');

const router = express.Router();
router.use(requireOperator, requireRolePermission('booking.change.read'));
router.patch('/:id/price', requireRolePermission('booking.review'), async (req, res) => res.json({ success: true, data: await require('../services/booking-change-request.service').offerChangePrice(req.params.id, req.body, req.user.user_id) }));

router.get('/', changeRequestController.getChangeRequests);
router.get('/:id', changeRequestController.getChangeRequestById);

router.patch('/:id/approve', requireRolePermission('booking.review'), changeRequestController.approveChangeRequest);
router.patch('/:id/reject', requireRolePermission('booking.review'), changeRequestController.rejectChangeRequest);

module.exports = router;
