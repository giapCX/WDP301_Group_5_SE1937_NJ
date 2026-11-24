const express = require('express');
const controller = require('../controllers/management.controller');
const requireManagementRole = require('../middleware/require-management-role.middleware');
const { requireResourcePermission } = require('../middleware/require-management-role.middleware');

const router = express.Router();
router.use(requireManagementRole('admin', 'manager'));
router.get('/:resource', requireResourcePermission, controller.list);
router.post('/:resource', requireResourcePermission, controller.create);
router.patch('/:resource/:id', requireResourcePermission, controller.update);

module.exports = router;
