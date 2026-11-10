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
    findPending: (status) => users.find(
      status === 'all' ? {} : { $or: [{ 'identity_kyc.status': status }, { 'driver_license.verification_status': status }] },
      { projection: { full_name: 1, email: 1, phone: 1, identity_kyc: 1, driver_license: 1, created_at: 1 }, sort: { 'identity_kyc.submitted_at': 1 } },
    ),
    createAudit: (item) => audits.create(item),
    readFile: (key) => fileRepository.read(key),
  };
}
