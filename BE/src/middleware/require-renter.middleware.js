const HttpError = require('../utils/http-error');

function requireRenter(req, res, next) {
  if (!req.user || !Number.isSafeInteger(req.user.user_id) || req.user.user_id < 1) {
    return next(new HttpError(401, 'Bạn cần đăng nhập để thực hiện thao tác này'));
  }
  if (req.user.role_name !== 'renter' || req.user.status !== 'active') {
    return next(new HttpError(403, 'Chỉ tài khoản Người thuê đang hoạt động được truy cập'));
  }
  return next();
}

module.exports = requireRenter;
