import { Types } from 'mongoose';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../service/auth.service.js';
import { httpError } from '../utils/http-error.js';

const { ObjectId } = Types;

export function requireGarageStaff(database, permission = 'vehicle.intake') {
  const repository = createAuthRepository(database);
  const auth = createAuthService(repository);
  return async (request, _response, next) => {
    const session = await auth.authenticate(request.headers.authorization);
    const roleIds = [
      session.user.primary_role_id,
      ...(session.user.additional_role_ids || []),
    ].filter((id) => id instanceof ObjectId);
    // Read current permissions from MongoDB; JWT claims can outlive a role change.
    const roles = await repository.findRolesByIds(roleIds);
    const permissions = [...new Set(roles.flatMap((role) => role.permissions || []))];
    const required = Array.isArray(permission) ? permission : [permission];
    if (!required.some((value) => permissions.includes(value))) throw httpError(403, `Tài khoản không có quyền ${required.join(' / ')}.`);
    Object.assign(request, session);
    request.actor = { _id: session.user._id };
    request.garagePermissions = permissions;
    next();
  };
}
