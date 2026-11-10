import { timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { createAuthRepository } from '../modules/auth/auth.repository.js';
import { createAuthService } from '../modules/auth/auth.service.js';
import { httpError } from '../utils/http-error.js';

export function createAuthMiddleware(database) {
  const service = createAuthService(createAuthRepository(database));
  return async (request, _response, next) => {
    try {
      Object.assign(request, await service.authenticate(request.headers.authorization));
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireGarageStaff(
  database,
  config,
  permission = 'vehicle.intake',
) {
  return async (request, _response, next) => {
    try {
      if (
        config.production ||
        !config.token ||
        config.token.length < 32 ||
        !/^[a-f\d]{24}$/i.test(config.userId || '')
      ) {
        throw httpError(
          503,
          'API gara chưa có cấu hình xác thực. Cấu hình token dev hoặc tích hợp đăng nhập trước khi sử dụng.',
        );
      }

      const supplied = request.get('authorization');
      const expected = Buffer.from(`Bearer ${config.token}`);
      const actual = Buffer.from(supplied || '');
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      ) {
        throw httpError(401, 'Thông tin xác thực không hợp lệ.');
      }

      const actor = await database
        .collection('users')
        .findOne(
          { _id: new ObjectId(config.userId), account_status: 'active' },
          { projection: { _id: 1, primary_role_id: 1, additional_role_ids: 1 } },
        );
      if (!actor) throw httpError(403, 'Tài khoản nhân viên không hoạt động.');

      const roleIds = [
        actor.primary_role_id,
        ...(actor.additional_role_ids || []),
      ].filter((id) => id instanceof ObjectId);
      const role = await database
        .collection('roles')
        .findOne(
          { _id: { $in: roleIds }, permissions: permission },
          { projection: { _id: 1 } },
        );
      if (!role) throw httpError(403, `Tài khoản không có quyền ${permission}.`);

      request.actor = { _id: actor._id };
      next();
    } catch (error) {
      next(error);
    }
  };
}
