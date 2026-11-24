const HttpError = require('../utils/http-error');

function requireDriver(req, res, next) {
  if (!req.user || !Number.isSafeInteger(req.user.user_id) || req.user.user_id < 1)
    return next(new HttpError(401, 'Bạn cần đăng nhập'));
  if (req.user.role_name !== 'driver' || req.user.status !== 'active')
    return next(new HttpError(403, 'Chỉ tài xế đang hoạt động được truy cập'));
  return next();
}

module.exports = requireDriver;
