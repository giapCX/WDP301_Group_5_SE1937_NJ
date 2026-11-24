const { Router } = require('express');
const controller = require('../controllers/trip-monitoring.controller');
const requireOperator = require('../middleware/require-operator.middleware');
const router = Router();
router.use(requireOperator);
router.get('/', controller.list);
router.get('/:id', controller.detail);
module.exports = router;
