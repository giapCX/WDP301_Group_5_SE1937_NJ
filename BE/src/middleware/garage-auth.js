import { timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { httpError } from '../utils/http-error.js';

// Temporary development authentication. The actor is configured on the server,
// never taken from a request body or an untrusted user-ID header.
export function requireGarageStaff(database, config) {
  return async (request, _response, next) => {
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
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw httpError(401, 'Thông tin xác thực không hợp lệ.');
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
        { _id: { $in: roleIds }, permissions: 'vehicle.intake' },
        { projection: { _id: 1 } },
      );
    if (!role) throw httpError(403, 'Tài khoản không có quyền tiếp nhận xe.');
    request.actor = { _id: actor._id };
    next();
  };
}
