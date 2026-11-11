import { createRenterRepository } from '../repositories/renter.repository.js';
import { httpError } from '../utils/http-error.js';

export function createRenterRoleMiddleware(database) {
  const repository = createRenterRepository(database);
  return async function requireRenterRole(request, _response, next) {
    try {
      const ids = [request.user.primary_role_id, ...(request.user.additional_role_ids || [])].filter(Boolean);
      const role = await repository.one('roles', { _id: { $in: ids }, code: 'RENTER' });
      if (!role) return next(httpError(403, 'Chức năng này dành cho tài khoản renter.'));
      next();
    } catch (error) {
      next(error);
    }
  };
}
