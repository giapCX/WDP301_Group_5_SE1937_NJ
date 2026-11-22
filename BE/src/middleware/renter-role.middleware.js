import { createAuthRepository } from '../repositories/auth.repository.js';
import { httpError } from '../utils/http-error.js';

export function createRenterRoleMiddleware(database) {
  const repository = createAuthRepository(database);
  return async function requireRenterRole(request, _response, next) {
    try {
      const ids = [request.user.primary_role_id, ...(request.user.additional_role_ids || [])].filter(Boolean);
      const roles = await repository.findRolesByIds(ids);
      if (!roles.some((role) => role.code === 'RENTER')) {
        return next(httpError(403, 'Giao diện VietTour này chỉ dành cho tài khoản người thuê.'));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
