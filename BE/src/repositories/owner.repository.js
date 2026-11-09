import mongoose from 'mongoose';
import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createOwnerRepository(connection) {
  const models = getModels(connection);
  const vehicles = createModelRepository(models.Vehicle);
  const settlements = createModelRepository(models.OwnerSettlement);
  const agreements = createModelRepository(models.ManagementAgreement);
  const audits = createModelRepository(models.AuditLog);
  const bucket = new mongoose.mongo.GridFSBucket(connection.db, { bucketName: 'owner_documents' });

  return {
    findRoles: (ids) => models.Role.find({ _id: { $in: ids } }).select({ code: 1 }).lean(),
    findVehicles: (ownerId) => vehicles.find({ owner_id: ownerId }, {
      projection: { brand: 1, model: 1, manufacture_year: 1, license_plate: 1, onboarding_status: 1, review_note: 1, physical_status: 1, created_at: 1, updated_at: 1 },
      sort: { updated_at: -1, _id: -1 },
    }),
    findSettlements: (ownerId) => settlements.find({ owner_id: ownerId }, { sort: { period_start: -1 } }),
    findAgreements: (ownerId) => agreements.find({ owner_id: ownerId }, { sort: { created_at: -1 } }),
    uploadPrivateFile(ownerId, input, purpose) {
      return new Promise((resolve, reject) => {
        const id = new mongoose.Types.ObjectId();
        const upload = bucket.openUploadStreamWithId(id, input.name.slice(0, 120), {
          contentType: input.contentType,
          metadata: { owner_id: ownerId, purpose },
        });
        upload.once('error', reject);
        upload.once('finish', () => resolve(id.toString()));
        upload.end(input.bytes);
      });
    },
    deletePrivateFiles: (ids) => Promise.allSettled(ids.map((id) => bucket.delete(id))),
    createVehicle: (vehicle) => vehicles.create(vehicle),
    deleteVehicle: (id) => models.Vehicle.deleteOne({ _id: id }),
    createAgreement: (agreement) => agreements.create(agreement),
    deleteAgreement: (id) => models.ManagementAgreement.deleteOne({ _id: id }),
    createAudit: (audit) => audits.create(audit),
  };
}
