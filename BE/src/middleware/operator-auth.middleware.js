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
        if (codes.includes('ADMIN') || (allowManager && codes.includes('MANAGER'))) {
          request.currentRoles = codes;
          return next();
        }

        const operatorRole = roles.find((role) => role.code === 'OPERATION_STAFF');
        if (!operatorRole?.permissions?.includes(permission)) {
          return next(httpError(403, 'Bạn không có quyền thực hiện thao tác này.'));
        }

        request.currentRoles = codes;
        return next();
      } catch (error) {
        return next(error);
      }
    };
  };
}
