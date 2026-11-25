const HttpError = require('../utils/http-error');
const mongoose = require('mongoose');
const ROLE_DEFAULT_PERMISSIONS = require('../config/role-permissions');

function requireManagementRole(...roles) {
  return function managementRole(request, _response, next) {
    if (!request.user || !Number.isSafeInteger(request.user.user_id)) {
      return next(new HttpError(401, 'Bạn cần đăng nhập để tiếp tục.'));
    }
    if (!roles.includes(request.user.role_name) || request.user.status !== 'active') {
      return next(new HttpError(403, 'Tài khoản không có quyền thực hiện thao tác này.'));
    }
    mongoose.connection.db.collection('roles').findOne({ role_id: request.user.role_id })
      .then((role) => {
        request.permissions = Array.isArray(role?.permissions)
          ? role.permissions : ROLE_DEFAULT_PERMISSIONS[request.user.role_name] || [];
        return next();
      }).catch(next);
  };
}

const PERMISSIONS = {
  GET: { users: 'account.read', roles: 'role.assign', vehicles: 'vehicle.read', driver_profiles: 'driver.read', pricing_rules: 'pricing.manage', service_policies: 'policy.manage', promotions: 'promotion.manage', reports: 'report.read', audit_logs: 'audit.read' },
  POST: { users: 'account.write', roles: 'role.assign', vehicles: 'vehicle.write', driver_profiles: 'driver.write', pricing_rules: 'pricing.manage', service_policies: 'policy.manage', promotions: 'promotion.manage' },
};

function requireResourcePermission(request, _response, next) {
  if (request.user?.role_name === 'admin') return next();
  const resource = request.params.resource;
  let permission = PERMISSIONS[request.method]?.[resource];
  if (request.method === 'PATCH') {
    if (resource === 'users') permission = request.body?.status !== undefined ? 'account.lock' : request.body?.role_id !== undefined ? 'role.assign' : 'account.write';
    if (resource === 'vehicles') permission = request.body?.approval_status !== undefined ? 'vehicle.review' : 'vehicle.write';
    if (resource === 'driver_profiles') permission = request.body?.approval_status !== undefined ? 'driver.review' : 'driver.write';
    if (['pricing_rules', 'service_policies', 'promotions'].includes(resource)) permission = resource === 'pricing_rules' ? 'pricing.manage' : resource === 'service_policies' ? 'policy.manage' : 'promotion.manage';
  }
  if (permission && !request.permissions?.includes(permission)) return next(new HttpError(403, 'Vai trò hiện tại chưa được cấp quyền cho thao tác này.'));
  return next();
}

function requirePermission(permission) {
  return function permissionGuard(request, _response, next) {
    if (!request.permissions?.includes(permission)) {
      return next(new HttpError(403, 'Vai trò hiện tại chưa được cấp quyền cho thao tác này.'));
    }
    return next();
  };
}

module.exports = requireManagementRole;
module.exports.requireResourcePermission = requireResourcePermission;
module.exports.requirePermission = requirePermission;
