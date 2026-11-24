const HttpError = require('../utils/http-error');

function requireGarage(req, res, next) {
  if (!req.user || !Number.isSafeInteger(req.user.user_id)) return next(new HttpError(401, 'Bạn cần đăng nhập'));
  if (req.user.role_name !== 'garage_staff' || req.user.status !== 'active') return next(new HttpError(403, 'Chỉ nhân viên Gara đang hoạt động được thao tác'));
  return next();
}

module.exports = requireGarage;
