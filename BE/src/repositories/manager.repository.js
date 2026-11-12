import { getModels, modelDefinitions } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createManagerRepository(connection, privateFiles) {
  const models = getModels(connection);
  const collections = Object.fromEntries(Object.entries(modelDefinitions).map(([name, definition]) => [definition.collection, createModelRepository(models[name])]));
  return {
    command: (command) => connection.db.command(command),
    startSession: () => connection.startSession(),
    collection(name) {
      if (!collections[name]) throw new Error(`Unknown manager collection: ${name}`);
      return collections[name];
    },
    vehicles: createModelRepository(models.Vehicle),
    listings: createModelRepository(models.VehicleListing),
    incidents: createModelRepository(models.IncidentCase),
    findWithdrawalHandovers: (ids) => models.VehicleWithdrawalRequest.find({ _id: { $in: ids } })
      .select('owner_return_handover').lean(),
    findIntakeHandovers: (ids) => models.VehicleIntake.find({ _id: { $in: ids } }).select('condition_snapshot').lean(),
    findIncidentHandovers: (ids) => models.RentalHandover.find({ _id: { $in: ids } })
      .select('baseline_handover_id damage_changes vehicle_condition occurred_at renter_response renter_dispute_note').lean(),
    settlements: createModelRepository(models.OwnerSettlement),
    auditLogs: createModelRepository(models.AuditLog),
    users: createModelRepository(models.User),
    roles: createModelRepository(models.Role),
    policies: createModelRepository(models.PlatformPolicy),
    inspections: createModelRepository(models.VehicleInspection),
    readPrivateFile: (key) => privateFiles?.read(key),
  };
}
