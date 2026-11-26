const { Router } = require('express');
const controller = require('../controllers/trip-monitoring.controller');
const requireOperator = require('../middleware/require-operator.middleware');
const { requireRolePermission } = require('../middleware/require-management-role.middleware');
const router = Router();
router.use(requireOperator);
router.get('/', requireRolePermission('booking.read.all'), controller.list);
router.get('/:id', requireRolePermission('booking.read.all'), controller.detail);
module.exports = router;
