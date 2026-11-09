import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createManagerRepository(connection) {
  const models = getModels(connection);
  return {
    vehicles: createModelRepository(models.Vehicle),
    listings: createModelRepository(models.VehicleListing),
    incidents: createModelRepository(models.IncidentCase),
    settlements: createModelRepository(models.OwnerSettlement),
    auditLogs: createModelRepository(models.AuditLog),
    users: createModelRepository(models.User),
    roles: createModelRepository(models.Role),
    policies: createModelRepository(models.PlatformPolicy),
    inspections: createModelRepository(models.VehicleInspection),
  };
}
