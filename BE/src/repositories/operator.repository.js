import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createOperatorRepository(connection) {
  const models = getModels(connection);

  return {
    roles: createModelRepository(models.Role),
    users: createModelRepository(models.User),
    vehicles: createModelRepository(models.Vehicle),
    vehicleInspections: createModelRepository(models.VehicleInspection),
    bookings: createModelRepository(models.Booking),
    managementAgreements: createModelRepository(models.ManagementAgreement),
    rentalAgreements: createModelRepository(models.RentalAgreement),
    incidents: createModelRepository(models.IncidentCase),
    auditLogs: createModelRepository(models.AuditLog),
  };
}
