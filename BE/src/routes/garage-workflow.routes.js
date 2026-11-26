const { Router, json, urlencoded } = require('express');
const requireGarage = require('../middleware/require-garage.middleware');
const { requireRolePermission } = require('../middleware/require-management-role.middleware');
const controller = require('../controllers/garage-workflow.controller');
const damage = require('../controllers/garage-damage.controller');

const router = Router();
router.use(requireGarage, requireRolePermission('garage.manage'));
router.get('/tasks', controller.tasks);
router.get('/tasks/:taskId/:vehicleId', controller.taskDetail);
router.get('/inspections/:id/photos/:index', controller.inspectionPhoto);
router.get('/damages/:inspectionId/photos/:index', damage.photo);
router.post('/damages', json({ limit: '9mb' }), damage.create);
router.post('/handovers', json(), controller.createHandover);
router.post('/handovers/:id/recheck', controller.recheckHandover);
router.post('/inspections', json({ limit: '9mb' }), urlencoded({ extended: true }), controller.inspection);
router.patch('/maintenance/:id', json(), urlencoded({ extended: true }), controller.maintenance);
router.patch('/maintenance/:id/repair', json(), controller.repair);
module.exports = router;
