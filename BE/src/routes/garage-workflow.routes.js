const { Router, json, urlencoded } = require('express');
const requireGarage = require('../middleware/require-garage.middleware');
const controller = require('../controllers/garage-workflow.controller');

const router = Router();
router.use(requireGarage);
router.get('/tasks', controller.tasks);
router.get('/inspections/:id/photos/:index', controller.inspectionPhoto);
router.post('/inspections', json({ limit: '9mb' }), urlencoded({ extended: true }), controller.inspection);
router.patch('/maintenance/:id', json(), urlencoded({ extended: true }), controller.maintenance);
module.exports = router;
