import { getModels, modelDefinitions } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createManagerRepository(connection) {
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
    settlements: createModelRepository(models.OwnerSettlement),
    auditLogs: createModelRepository(models.AuditLog),
    users: createModelRepository(models.User),
    roles: createModelRepository(models.Role),
    policies: createModelRepository(models.PlatformPolicy),
    inspections: createModelRepository(models.VehicleInspection),
  };
}
