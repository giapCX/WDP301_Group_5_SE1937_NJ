import { httpError } from '../utils/http-error.js';

export function attachManagerRoles(service) {
  return async (request, _response, next) => {
    try {
      request.currentRoles = await service.authorizeDashboard(request.user);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireManagerRoles(...allowedRoles) {
  return (request, _response, next) => {
    if (!allowedRoles.some((role) => request.currentRoles?.includes(role)))
      return next(httpError(403, 'Bạn không có quyền thực hiện chức năng này.'));
    next();
  };
}
