import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createIdentityVerificationRepository(connection, fileRepository) {
  const models = getModels(connection);
  const users = createModelRepository(models.User);
  const roles = createModelRepository(models.Role);
  const audits = createModelRepository(models.AuditLog);
  return {
    findUser: (id, projection) => users.findOne({ _id: id }, { projection }),
    findRoles: (ids) => roles.find({ _id: { $in: ids } }).exec(),
    updateUser: (id, update) => users.updateOne({ _id: id }, update),
    findPending: async (status) => {
      const ownerRoles = await roles.find({ code: { $in: ['OWNER', 'CAR_OWNER'] } }).exec();
      const ids = ownerRoles.map(({ _id }) => _id);
      return users.find({
        $and: [
          { $or: [{ primary_role_id: { $in: ids } }, { additional_role_ids: { $in: ids } }] },
          ...(status === 'all' ? [] : [{ $or: [{ 'identity_kyc.status': status }, { 'driver_license.verification_status': status }] }]),
        ],
      },
      { projection: { full_name: 1, email: 1, phone: 1, identity_kyc: 1, driver_license: 1, operator_identity_precheck: 1, created_at: 1 }, sort: { 'identity_kyc.submitted_at': 1 } },
      ).exec();
    },
    createAudit: (item) => audits.create(item),
    readFile: (key) => fileRepository.read(key),
  };
}
