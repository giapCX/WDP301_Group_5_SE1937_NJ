const { Router } = require('express');
const requireOperator = require('../middleware/require-operator.middleware');
const { requireRolePermission } = require('../middleware/require-management-role.middleware');
const controller = require('../controllers/operator-overview.controller');
const router = Router();
router.get('/dashboard', requireOperator, requireRolePermission('booking.read.all'), controller.overview);
router.get('/vehicles/available', requireOperator, requireRolePermission('vehicle.read'), controller.vehicles);
module.exports = router;
