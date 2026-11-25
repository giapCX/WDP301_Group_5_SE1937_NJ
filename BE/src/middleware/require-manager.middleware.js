const HttpError = require('../utils/http-error');
const mongoose = require('mongoose');
const ROLE_DEFAULT_PERMISSIONS = require('../config/role-permissions');

function requireManager(permission = 'report.read') {
  return function managerPermission(request, _response, next) {
    if (!request.user || !Number.isSafeInteger(request.user.user_id) || request.user.user_id < 1) {
      return next(new HttpError(401, 'Bạn cần đăng nhập để xem dashboard quản lý.'));
    }
    if (request.user.role_name !== 'manager' || request.user.status !== 'active') {
      return next(new HttpError(403, 'Chỉ tài khoản Manager đang hoạt động được xem dashboard này.'));
    }
    mongoose.connection.db.collection('roles').findOne({ role_id: request.user.role_id })
      .then((role) => {
        const permissions = Array.isArray(role?.permissions) ? role.permissions : ROLE_DEFAULT_PERMISSIONS.manager;
        if (!permissions.includes(permission)) {
          return next(new HttpError(403, 'Vai trò Manager chưa được cấp quyền cho thao tác này.'));
        }
        return next();
      }).catch(next);
  };
}

module.exports = requireManager;
