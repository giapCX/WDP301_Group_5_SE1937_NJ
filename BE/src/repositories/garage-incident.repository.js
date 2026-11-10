import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createGarageIncidentRepository(connection) {
  const models = getModels(connection);
  return {
    incidents: createModelRepository(models.IncidentCase), vehicles: createModelRepository(models.Vehicle),
    bookings: createModelRepository(models.Booking), auditLogs: createModelRepository(models.AuditLog),
    command: (command) => connection.db.command(command), startSession: () => connection.startSession(),
  };
}
