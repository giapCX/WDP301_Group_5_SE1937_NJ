const { Router } = require('express');
const requireGarage = require('../middleware/require-garage.middleware');
const controller = require('../controllers/garage-workflow.controller');

const router = Router();
router.use(requireGarage);
router.get('/tasks', controller.tasks);
router.post('/inspections', controller.inspection);
router.patch('/maintenance/:id', controller.maintenance);
module.exports = router;
