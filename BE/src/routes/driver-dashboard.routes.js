const { Router } = require('express');
const requireDriver = require('../middleware/require-driver.middleware');
const controller = require('../controllers/driver-dashboard.controller');
const router = Router();
router.use(requireDriver);
router.get('/dashboard', controller.dashboard);
router.get('/trips/:id', controller.detail);
module.exports = router;
