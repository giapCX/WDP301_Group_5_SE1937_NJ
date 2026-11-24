const service = require('../services/driver-dashboard.service');

async function dashboard(req, res, next) {
  try {
    return res
      .set('Cache-Control', 'no-store')
      .json({
        success: true,
        data: await service.dashboard(req.user.user_id, req.query),
      });
  } catch (error) {
    return next(error);
  }
}

async function detail(req, res, next) {
  try {
    return res
      .set('Cache-Control', 'no-store')
      .json({
        success: true,
        data: await service.detail(req.user.user_id, req.params.id),
      });
  } catch (error) {
    return next(error);
  }
}

module.exports = { dashboard, detail };
