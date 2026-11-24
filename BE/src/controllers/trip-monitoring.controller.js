const service = require('../services/trip-monitoring.service');
async function list(req, res, next) {
  try {
    return res
      .set('Cache-Control', 'no-store')
      .json({ success: true, data: await service.list(req.query) });
  } catch (error) {
    return next(error);
  }
}
async function detail(req, res, next) {
  try {
    return res
      .set('Cache-Control', 'no-store')
      .json({ success: true, data: await service.detail(req.params.id) });
  } catch (error) {
    return next(error);
  }
}
module.exports = { list, detail };
