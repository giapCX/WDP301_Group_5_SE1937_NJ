import { Types } from 'mongoose';
import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

const { ObjectId } = Types;
const vietTourRoles = {
  admin: 'ADMIN',
  driver: 'DRIVER',
  gara_staff: 'GARAGE_STAFF',
  manager: 'MANAGER',
  operator_staff: 'OPERATION_STAFF',
  renter: 'RENTER',
};

function normalizeVietTourUser(user) {
  return user && {
    ...user,
    account_status: user.account_status ?? user.status,
    primary_role_id: user.primary_role_id ?? user.role_id,
  };
}

function normalizeVietTourRole(role) {
  return role && { ...role, code: role.code ?? vietTourRoles[role.name], display_name: role.display_name ?? role.name };
}
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
function buildAccountQuery(account) {
  const trimmed = account.trim();
  const orConditions = [{
    email: {
      $regex: `^${escapeRegex(trimmed)}$`,
      $options: 'i'
    }
  }, {
    phone: trimmed
  }];
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 6) {
    const flexiblePattern = digits.split('').join('[- ]?');
    orConditions.push({
      phone: {
        $regex: flexiblePattern
      }
    });
  }
  return {
    $or: orConditions
  };
}
export function createAuthRepository(database) {
  const models = getModels(database);
  const users = createModelRepository(models.User);
  const roles = createModelRepository(models.Role);
  const audits = createModelRepository(models.AuditLog);
  const useVietTour = database.name === 'viet_tour';
  const nativeUsers = database.db.collection('users');
  const nativeRoles = database.db.collection('roles');
  return {
    async canViewOwnerGaragePhoto(ownerId, key) {
      const vehicles = await models.Vehicle.find({ owner_id: ownerId }).select('_id').lean();
      const vehicle_id = { $in: vehicles.map(({ _id }) => _id) };
      const [inspection, intake, ownerReturn] = await Promise.all([
        models.VehicleInspection.exists({ vehicle_id, approval_status: { $ne: 'draft' }, 'condition_report.photo_keys': key }),
        models.VehicleWithdrawalRequest.exists({ vehicle_id, owner_id: ownerId, 'owner_return_handover.condition.photo_keys': key }),
        models.VehicleIntake.exists({ vehicle_id, status: { $in: ['draft', 'completed'] }, 'condition_snapshot.photo_keys': key }),
      ]);
      return Boolean(inspection || intake || ownerReturn);
    },
    findByAccount: async account => {
      const filter = buildAccountQuery(account);
      return useVietTour ? normalizeVietTourUser(await nativeUsers.findOne(filter)) : users.findOne(filter);
    },
    findById: async id => {
      const filter = { _id: new ObjectId(id) };
      return useVietTour ? normalizeVietTourUser(await nativeUsers.findOne(filter)) : users.findOne(filter);
    },
    updatePassword: (id, passwordHash) => users.updateOne({
      _id: id
    }, {
      $set: {
        password_hash: passwordHash,
        updated_at: new Date()
      }
    }),
    findRoleById: async id => {
      const filter = { _id: id };
      return useVietTour ? normalizeVietTourRole(await nativeRoles.findOne(filter)) : roles.findOne(filter);
    },
    findRolesByIds: async ids => {
      const filter = { _id: { $in: ids } };
      if (!useVietTour) return roles.find(filter).exec();
      return (await nativeRoles.find(filter).toArray()).map(normalizeVietTourRole);
    },
    findRoleWithPermission: (ids, permission) => roles.findOne({
      _id: { $in: ids }, permissions: permission,
    }, { projection: { _id: 1 } }),
    createAudit: (audit) => audits.create(audit),
  };
}
