import { ObjectId } from 'mongodb';

export function createManagerService(repository) {
  return {
    managerId: (request) => new ObjectId(request.tokenPayload.sub),
    async writeAudit(request, action, entityType, entityId, changes = {}) {
      await repository.collection('audit_logs').insertOne({
        actor_user_id: this.managerId(request),
        action,
        entity_type: entityType,
        entity_id: entityId,
        sanitized_changes: changes,
        ip_address_masked: null,
        created_at: new Date(),
      });
    },
    authorizeDashboard: async (request, _response, next) => {
      try {
        const roleIds = [request.user.primary_role_id, ...(request.user.additional_role_ids || [])].filter(Boolean);
        const roleRows = roleIds.length
          ? await repository.collection('roles').find({ _id: { $in: roleIds } }).project({ code: 1 }).toArray()
          : [];
        const roleCodes = roleRows.map(({ code }) => code);
        if (!roleCodes.includes('MANAGER') && !roleCodes.includes('ADMIN')) {
          return next(Object.assign(new Error('Bạn không có quyền xem trang quản lý.'), { status: 403 }));
        }
        request.currentRoles = roleCodes;
        next();
      } catch (error) {
        next(error);
      }
    },
    requireRoles: (...allowedRoles) => (request, _response, next) => {
      if (!allowedRoles.some((role) => request.currentRoles?.includes(role))) {
        return next(Object.assign(new Error('Bạn không có quyền thực hiện chức năng này.'), { status: 403 }));
      }
      next();
    },
  };
}
