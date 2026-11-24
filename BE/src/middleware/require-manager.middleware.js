const HttpError = require('../utils/http-error');

function requireManager(request, _response, next) {
  if (!request.user || !Number.isSafeInteger(request.user.user_id) || request.user.user_id < 1) {
    return next(new HttpError(401, 'Bạn cần đăng nhập để xem dashboard quản lý.'));
  }
  if (request.user.role_name !== 'manager' || request.user.status !== 'active') {
    return next(new HttpError(403, 'Chỉ tài khoản Manager đang hoạt động được xem dashboard này.'));
  }
  return next();
}

module.exports = requireManager;
