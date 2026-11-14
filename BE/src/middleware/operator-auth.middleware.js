import { httpError } from '../utils/http-error.js';

export function createOperatorPermissionMiddleware(rolesRepository) {
  return function requirePermission(permission, { allowManager = false } = {}) {
    return async (request, _response, next) => {
      try {
        const roleIds = [request.user.primary_role_id, ...(request.user.additional_role_ids || [])].filter(Boolean);
        const roles = roleIds.length
          ? await rolesRepository.find({ _id: { $in: roleIds } }).exec()
          : [];
        const codes = roles.map((role) => role.code);
        const permissions = [...new Set(roles.flatMap((role) => role.permissions || []))];
        request.currentRoles = codes;
        request.currentPermissions = permissions;
        if (codes.includes('ADMIN') || (allowManager && codes.includes('MANAGER'))) {
          return next();
        }

        if (!permissions.includes(permission)) {
          return next(httpError(403, 'Bạn không có quyền thực hiện thao tác này.'));
        }

        return next();
      } catch (error) {
        return next(error);
      }
    };
  };
}
