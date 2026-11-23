const express = require('express');
const requireRenter = require('../middleware/require-renter.middleware');
const { findRenterDashboard } = require('../repositories/renter-dashboard.repository');

const router = express.Router();

router.get('/', requireRenter, async (req, res) => {
  const dashboard = await findRenterDashboard(req.user.user_id);
  res.set('Cache-Control', 'no-store').json(dashboard);
});

module.exports = router;
