import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../service/auth.service.js';
import { httpError } from '../utils/http-error.js';

export function requireGaragePhotoViewer(connection) {
  const repository = createAuthRepository(connection);
  const auth = createAuthService(repository);
  return async (request, _response, next) => {
    const session = await auth.authenticate(request.headers.authorization);
    const roles = await repository.findRolesByIds([session.user.primary_role_id, ...(session.user.additional_role_ids || [])].filter(Boolean));
    const allowed = roles.some((role) => role.code === 'MANAGER' || role.code === 'OPERATION_STAFF' && role.permissions?.includes('operation.incident.read') || (role.permissions || []).some((permission) => ['vehicle.inspect', 'vehicle.intake', 'handover.record', 'case.report'].includes(permission)));
    const ownerAllowed = !allowed && roles.some((role) => ['OWNER', 'CAR_OWNER'].includes(role.code))
      && await repository.canViewOwnerGaragePhoto(session.user._id, `garage-photos/${request.params.owner}/${request.params.name}`);
    if (!allowed && !ownerAllowed) throw httpError(403, 'Bạn không có quyền xem ảnh nghiệp vụ Garage.');
    Object.assign(request, session);
    next();
  };
}
