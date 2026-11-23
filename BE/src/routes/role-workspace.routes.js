import { Router } from 'express';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../services/auth.service.js';
import { httpError } from '../utils/http-error.js';
import { Types } from 'mongoose';

const metrics = {
  ADMIN: [['users', 'Tài khoản'], ['roles', 'Vai trò'], ['vehicles', 'Xe']],
  MANAGER: [['vehicles', 'Xe'], ['bookings', 'Đơn đặt'], ['incidents', 'Sự cố']],
  OPERATION_STAFF: [['bookings', 'Đơn đặt'], ['trip_assignments', 'Lượt phân công']],
  GARAGE_STAFF: [['vehicles', 'Xe'], ['vehicle_inspections', 'Phiếu kiểm tra']],
};

export function createRoleWorkspaceRouter(database) {
  const router = Router();
  const auth = createAuthService(createAuthRepository(database));
  router.get('/:role', async (request, response) => {
    const { data: user } = await auth.getCurrentUser(request.get('Authorization'));
    const { role } = request.params;
    if (!user.roles.includes(role)) throw httpError(403, 'Tài khoản không có quyền truy cập dashboard này.');

    const data = { name: user.full_name || user.email, metrics: [], assignments: [] };
    if (role === 'DRIVER') {
      const userId = new Types.ObjectId(user._id);
      const profile = await database.db.collection('driver_profiles').findOne(
        { user_id: userId }, { projection: { _id: 1 } },
      );
      const driverIds = profile ? [userId, profile._id] : [userId];
      data.assignments = await database.db.collection('trip_assignments').find(
        { driver_id: { $in: driverIds } },
        { projection: { service_start_at: 1, service_end_at: 1, leg_type: 1, status: 1 } },
      ).sort({ service_start_at: -1 }).limit(20).toArray();
    } else {
      if (database.name !== 'viet_tour' || !Object.hasOwn(metrics, role)) {
        throw httpError(404, 'Dashboard không khả dụng.');
      }
      data.metrics = await Promise.all(metrics[role].map(async ([collection, label]) => ({
        label, count: await database.db.collection(collection).countDocuments(),
      })));
    }

    response.set('Cache-Control', 'no-store').json({ data });
  });
  return router;
}
