const HttpError = require('../utils/http-error');
const mongoose = require('mongoose');
const ROLE_DEFAULT_PERMISSIONS = require('../config/role-permissions');
const { MANAGEMENT_ROLES, RESOURCE_PERMISSIONS } = require('../config/management.constants');

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

function requireRolePermission(permission) {
  return function rolePermission(request, _response, next) {
    if (!request.user || !Number.isSafeInteger(request.user.user_id)) {
      return next(new HttpError(401, 'Bạn cần đăng nhập để tiếp tục.'));
    }
    if (Array.isArray(request.permissions)) {
      return request.permissions.includes(permission)
        ? next()
        : next(new HttpError(403, 'Vai trò hiện tại chưa được cấp quyền cho thao tác này.'));
    }
    const roleQuery = mongoose.connection.db
      ? mongoose.connection.db.collection('roles').findOne({ role_id: request.user.role_id })
      : Promise.resolve(null);
    roleQuery
      .then((role) => {
        const permissions = Array.isArray(role?.permissions)
          ? role.permissions : ROLE_DEFAULT_PERMISSIONS[request.user.role_name] || [];
        if (!permissions.includes(permission)) {
          return next(new HttpError(403, 'Vai trò hiện tại chưa được cấp quyền cho thao tác này.'));
        }
        request.permissions = permissions;
        return next();
      }).catch(next);
  };
}

function requireResourcePermission(request, _response, next) {
  if (request.user?.role_name === MANAGEMENT_ROLES.ADMIN) return next();
  const resource = request.params.resource;
  const requiredPermissions = [];
  const addPermission = (permission) => { if (permission) requiredPermissions.push(permission); };
  addPermission(RESOURCE_PERMISSIONS[request.method]?.[resource]);
  if (request.method === 'PATCH') {
    const body = request.body || {};
    if (resource === 'users') {
      if (body.status !== undefined) addPermission('account.lock');
      if (body.role_id !== undefined) addPermission('role.assign');
      if (['full_name', 'email', 'phone'].some((field) => body[field] !== undefined)) addPermission('account.write');
    }
    if (resource === 'vehicles') {
      if (body.approval_status !== undefined) addPermission('vehicle.review');
      if (Object.keys(body).some((field) => field !== 'approval_status')) addPermission('vehicle.write');
    }
    if (resource === 'driver_profiles') {
      if (body.approval_status !== undefined) addPermission('driver.review');
      if (Object.keys(body).some((field) => field !== 'approval_status')) addPermission('driver.write');
    }
    if (['pricing_rules', 'service_policies'].includes(resource)) addPermission(resource === 'pricing_rules' ? 'pricing.manage' : 'policy.manage');
  }
  if (requiredPermissions.some((permission) => !request.permissions?.includes(permission))) return next(new HttpError(403, 'Vai trò hiện tại chưa được cấp quyền cho thao tác này.'));
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
module.exports.requireRolePermission = requireRolePermission;
