const express = require('express');
const HttpError = require('../utils/http-error');
const requireManager = require('../middleware/require-manager.middleware');
const { findManagerDashboard } = require('../repositories/manager-dashboard.repository');

const router = express.Router();
const contractCompany = require('../services/contract-company.service');

router.get('/contract-profile', requireManager(), async (req, res) => {
  res.set('Cache-Control', 'no-store').json(await contractCompany.managerProfile(req.user.user_id));
});
router.put('/contract-profile', requireManager(), async (req, res) => {
  res.json(await contractCompany.saveManagerProfile(req.user.user_id, req.body));
});

function parsePeriodNumber(value, field, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw new HttpError(400, `${field} không hợp lệ.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new HttpError(400, `${field} không hợp lệ.`);
  }
  return parsed;
}

router.get('/', requireManager(), async (request, response) => {
  const now = new Date();
  const year = parsePeriodNumber(request.query.year, 'year', now.getFullYear(), 2000, now.getFullYear() + 1);
  const month = parsePeriodNumber(request.query.month, 'month', now.getMonth() + 1, 1, 12);
  const dashboard = await findManagerDashboard({ year, month });
  response.set('Cache-Control', 'no-store').json(dashboard);
});

module.exports = router;
