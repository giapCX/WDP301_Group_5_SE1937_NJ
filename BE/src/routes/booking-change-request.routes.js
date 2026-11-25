const express = require('express');
const changeRequestController = require('../controllers/booking-change-request.controller');

const requireOperator = require('../middleware/require-operator.middleware');

const router = express.Router();
router.use(requireOperator);
router.patch('/:id/price', async (req, res) => res.json({ success: true, data: await require('../services/booking-change-request.service').offerChangePrice(req.params.id, req.body, req.user.user_id) }));

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
