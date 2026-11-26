const express = require('express');
const requireRenter = require('../middleware/require-renter.middleware');
const { requireRolePermission } = require('../middleware/require-management-role.middleware');
const { findRenterDashboard } = require('../repositories/renter-dashboard.repository');

const router = express.Router();

router.get('/', requireRenter, requireRolePermission('booking.read.own'), async (req, res) => {
  const dashboard = await findRenterDashboard(req.user.user_id);
  res.set('Cache-Control', 'no-store').json(dashboard);
});

module.exports = router;
