import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createGarageHandoverRepository(connection) {
  const models = getModels(connection);
  return {
    withdrawals: createModelRepository(models.VehicleWithdrawalRequest),
    listings: createModelRepository(models.VehicleListing),
    handovers: createModelRepository(models.RentalHandover),
    bookings: createModelRepository(models.Booking), vehicles: createModelRepository(models.Vehicle),
    agreements: createModelRepository(models.RentalAgreement), managementAgreements: createModelRepository(models.ManagementAgreement),
    users: createModelRepository(models.User), deposits: createModelRepository(models.SecurityDeposit),
    payments: createModelRepository(models.PaymentTransaction), intakes: createModelRepository(models.VehicleIntake),
    incidents: createModelRepository(models.IncidentCase), auditLogs: createModelRepository(models.AuditLog),
    command: (command) => connection.db.command(command), startSession: () => connection.startSession(),
  };
}
