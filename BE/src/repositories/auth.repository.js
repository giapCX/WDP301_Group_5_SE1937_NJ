import { Types } from 'mongoose';
import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

const { ObjectId } = Types;
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
    findByAccount: account => users.findOne(buildAccountQuery(account)),
    findById: id => users.findOne({
      _id: new ObjectId(id)
    }),
    updatePassword: (id, passwordHash) => users.updateOne({
      _id: id
    }, {
      $set: {
        password_hash: passwordHash,
        updated_at: new Date()
      }
    }),
    findRoleById: id => roles.findOne({
      _id: id
    }),
    findRolesByIds: ids => roles.find({
      _id: {
        $in: ids
      }
    }).exec(),
    findRoleWithPermission: (ids, permission) => roles.findOne({
      _id: { $in: ids }, permissions: permission,
    }, { projection: { _id: 1 } }),
    createAudit: (audit) => audits.create(audit),
  };
}
