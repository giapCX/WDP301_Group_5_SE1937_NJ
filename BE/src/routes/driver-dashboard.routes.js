const { Router } = require('express');
const requireDriver = require('../middleware/require-driver.middleware');
const { requireRolePermission } = require('../middleware/require-management-role.middleware');
const controller = require('../controllers/driver-dashboard.controller');
const router = Router();
router.use(requireDriver, requireRolePermission('booking.read.own'));
router.get('/dashboard', controller.dashboard);
router.get('/trips/:id', controller.detail);
module.exports = router;
