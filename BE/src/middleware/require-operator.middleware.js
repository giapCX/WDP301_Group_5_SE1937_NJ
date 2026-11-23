const HttpError = require('../utils/http-error');

// A trusted authentication middleware must supply req.user before this guard:
// { user_id: Number, role_name: 'operator', status: 'active' }.
// Never construct req.user from unverified headers or request body fields.
function requireOperator(req, res, next) {
  if (!req.user || !Number.isSafeInteger(req.user.user_id) || req.user.user_id < 1) {
    return next(new HttpError(401, 'Bạn cần đăng nhập để thực hiện thao tác này'));
  }

  if (req.user.role_name !== 'operator' || req.user.status !== 'active') {
    return next(new HttpError(403, 'Chỉ Operator đang hoạt động được xử lý booking'));
  }

  return next();
}

module.exports = requireOperator;
