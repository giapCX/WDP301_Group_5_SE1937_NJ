const repository = require('../repositories/operator-overview.repository');

async function overview(req, res, next) {
  try {
    return res.json({ success: true, data: await repository.getOverview() });
  } catch (error) {
    return next(error);
  }
}
async function vehicles(req, res, next) {
  try {
    return res.json({ success: true, data: await repository.getAvailableVehicles() });
  } catch (error) {
    return next(error);
  }
}
module.exports = { overview, vehicles };
