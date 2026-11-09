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
    const role = await repository.findRoleWithPermission(roleIds, permission);
    if (!role) throw httpError(403, `Tài khoản không có quyền ${permission}.`);
    Object.assign(request, session);
    request.actor = { _id: session.user._id };
    next();
  };
}
