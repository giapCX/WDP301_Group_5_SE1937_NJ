const express = require('express');
const HttpError = require('../utils/http-error');
const requireManager = require('../middleware/require-manager.middleware');
const { findManagerDashboard } = require('../repositories/manager-dashboard.repository');

const router = express.Router();

function parsePeriodNumber(value, field, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw new HttpError(400, `${field} không hợp lệ.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new HttpError(400, `${field} không hợp lệ.`);
  }
  return parsed;
}

router.get('/', requireManager, async (request, response) => {
  const now = new Date();
  const year = parsePeriodNumber(request.query.year, 'year', now.getFullYear(), 2000, now.getFullYear() + 1);
  const month = parsePeriodNumber(request.query.month, 'month', now.getMonth() + 1, 1, 12);
  const vehicleStatus = typeof request.query.status === 'string' ? request.query.status.trim() : '';
  const search = typeof request.query.search === 'string' ? request.query.search.trim().slice(0, 100) : '';
  const dashboard = await findManagerDashboard({ year, month, vehicleStatus, search });
  response.set('Cache-Control', 'no-store').json(dashboard);
});

module.exports = router;
