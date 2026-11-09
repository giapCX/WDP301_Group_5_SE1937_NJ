import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createVehicleIntakeRepository(connection) {
  const models = getModels(connection);
  return {
    intakes: createModelRepository(models.VehicleIntake),
    vehicles: createModelRepository(models.Vehicle),
    inspections: createModelRepository(models.VehicleInspection),
    agreements: createModelRepository(models.ManagementAgreement),
    users: createModelRepository(models.User),
    auditLogs: createModelRepository(models.AuditLog),
    command: (command) => connection.db.command(command),
    startSession: () => connection.startSession(),
  };
}
