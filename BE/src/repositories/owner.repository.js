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
    findWithdrawalRequests: (ownerId) => models.VehicleWithdrawalRequest.find({ owner_id: ownerId }).sort({ created_at: -1 }).lean(),
    findIncidents: (vehicleIds) => models.IncidentCase.find({ vehicle_id: { $in: vehicleIds } }).sort({ created_at: -1 }).lean(),
    findAgreement: (ownerId, agreementId) => models.ManagementAgreement.findOne({ _id: agreementId, owner_id: ownerId }).lean(),
    signPendingAgreement: (ownerId, agreementId, signatureInfo, active) => models.ManagementAgreement.updateOne({ _id: agreementId, owner_id: ownerId, status: 'pending_signatures', $or: [{ 'signature_info.owner_signed_at': { $exists: false } }, { 'signature_info.owner_signed_at': null }] }, { $set: { signature_info: signatureInfo, status: active ? 'active' : 'pending_signatures', updated_at: signatureInfo.owner_signed_at } }),
    requestAgreementTermination: (ownerId, agreementId, at, reason) => models.ManagementAgreement.updateOne({ _id: agreementId, owner_id: ownerId, status: 'active' }, { $set: { status: 'termination_requested', termination_info: { reason, notice_method: 'owner_portal', legal_effective_at: at }, updated_at: at } }),
    findVehicle: (ownerId, vehicleId) => models.Vehicle.findOne({ _id: vehicleId, owner_id: ownerId }).lean(),
    findBooking: (vehicleId, bookingId) => models.Booking.findOne({ _id: bookingId, vehicle_id: vehicleId }).select({ _id: 1 }).lean(),
    findOpenWithdrawal: (vehicleId) => models.VehicleWithdrawalRequest.findOne({ vehicle_id: vehicleId, status: { $in: ['requested', 'coordinating_bookings', 'pending_review', 'processing'] } }).lean(),
    findActiveBookings: (vehicleId) => models.Booking.find({ vehicle_id: vehicleId, status: { $in: ['confirmed', 'ongoing', 'in_progress'] } }).select({ _id: 1 }).lean(),
    findPayableSettlements: (ownerId) => models.OwnerSettlement.find({ owner_id: ownerId, payout_status: 'payable' }).sort({ period_start: 1, _id: 1 }).lean(),
    reserveSettlement: (ownerId, id, transactionId) => models.OwnerSettlement.updateOne({ _id: id, owner_id: ownerId, payout_status: 'payable' }, { $set: { payout_status: 'payout_requested', payout_transaction_id: transactionId } }),
    releaseSettlements: (ids, transactionId) => models.OwnerSettlement.updateMany({ _id: { $in: ids }, payout_transaction_id: transactionId, payout_status: 'payout_requested' }, { $set: { payout_status: 'payable' }, $unset: { payout_transaction_id: 1 } }),
    createPaymentTransaction: (transaction) => models.PaymentTransaction.create(transaction),
    createWithdrawalRequest: (request) => models.VehicleWithdrawalRequest.create(request),
    createIncident: (incident) => models.IncidentCase.create(incident),
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
