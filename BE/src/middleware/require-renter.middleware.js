const HttpError = require('../utils/http-error');

function requireRenter(req, res, next) {
  if (!req.user || !Number.isSafeInteger(req.user.user_id) || req.user.user_id < 1) {
    return next(new HttpError(401, 'Bạn cần đăng nhập để gửi yêu cầu đổi lịch'));
  }
  if (req.user.role_name !== 'renter' || req.user.status !== 'active') {
    return next(new HttpError(403, 'Chỉ Renter đang hoạt động được gửi yêu cầu'));
  }
  return next();
}

module.exports = requireRenter;
