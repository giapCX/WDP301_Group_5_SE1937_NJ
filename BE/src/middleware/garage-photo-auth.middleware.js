import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../service/auth.service.js';
import { httpError } from '../utils/http-error.js';

export function requireGaragePhotoViewer(connection) {
  const repository = createAuthRepository(connection);
  const auth = createAuthService(repository);
  return async (request, _response, next) => {
    const session = await auth.authenticate(request.headers.authorization);
    const roles = await repository.findRolesByIds([session.user.primary_role_id, ...(session.user.additional_role_ids || [])].filter(Boolean));
    const allowed = roles.some((role) => role.code === 'MANAGER' || role.code === 'OPERATION_STAFF' && role.permissions?.includes('incident.review') || (role.permissions || []).some((permission) => ['vehicle.inspect', 'vehicle.intake', 'handover.record', 'case.report'].includes(permission)));
    if (!allowed) throw httpError(403, 'Bạn không có quyền xem ảnh nghiệp vụ Garage.');
    Object.assign(request, session);
    next();
  };
}
