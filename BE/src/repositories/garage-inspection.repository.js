import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createVehicleInspectionRepository(connection) {
  const models = getModels(connection);
  return {
    inspections: createModelRepository(models.VehicleInspection),
    vehicles: createModelRepository(models.Vehicle),
    intakes: createModelRepository(models.VehicleIntake),
    users: createModelRepository(models.User),
    auditLogs: createModelRepository(models.AuditLog),
    command: (command) => connection.db.command(command),
    startSession: () => connection.startSession(),
  };
}
