const { Router } = require('express');
const requireOperator = require('../middleware/require-operator.middleware');
const controller = require('../controllers/operator-overview.controller');
const router = Router();
router.get('/dashboard', requireOperator, controller.overview);
router.get('/vehicles/available', requireOperator, controller.vehicles);
module.exports = router;
