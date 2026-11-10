import { getModels } from '../models/index.js';
import { createModelRepository } from './base.repository.js';

export function createContractRepository(connection) {
  const m = getModels(connection);
  return {
    startSession: () => connection.startSession(),
    agreement: (type) => createModelRepository(type === 'management' ? m.ManagementAgreement : m.RentalAgreement),
    vehicles: createModelRepository(m.Vehicle), bookings: createModelRepository(m.Booking),
    inspections: createModelRepository(m.VehicleInspection), users: createModelRepository(m.User),
    roles: createModelRepository(m.Role), audits: createModelRepository(m.AuditLog),
  };
}
