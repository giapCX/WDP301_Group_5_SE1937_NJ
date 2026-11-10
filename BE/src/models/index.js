import { collections } from '../database/indexes.js';
import { roleSchema } from './role.model.js';
import { userSchema } from './user.model.js';
import { vehicleSchema } from './vehicle.model.js';
import { vehicleInspectionSchema } from './vehicle-inspection.model.js';
import { managementAgreementSchema } from './management-agreement.model.js';
import { vehicleIntakeSchema } from './vehicle-intake.model.js';
import { vehicleListingSchema } from './vehicle-listing.model.js';
import { bookingSchema } from './booking.model.js';
import { rentalAgreementSchema } from './rental-agreement.model.js';
import { rentalHandoverSchema } from './rental-handover.model.js';
import { paymentTransactionSchema } from './payment-transaction.model.js';
import { securityDepositSchema } from './security-deposit.model.js';
import { ownerSettlementSchema } from './owner-settlement.model.js';
import { incidentCaseSchema } from './incident-case.model.js';
import { vehicleWithdrawalRequestSchema } from './vehicle-withdrawal-request.model.js';
import { platformPolicySchema } from './platform-policy.model.js';
import { notificationSchema } from './notification.model.js';
import { auditLogSchema } from './audit-log.model.js';
import { systemReportSchema } from './system-report.model.js';

export const modelDefinitions = {
  Role: { collection: 'roles', schema: roleSchema },
  User: { collection: 'users', schema: userSchema },
  Vehicle: { collection: 'vehicles', schema: vehicleSchema },
  VehicleInspection: { collection: 'vehicle_inspections', schema: vehicleInspectionSchema },
  ManagementAgreement: { collection: 'management_agreements', schema: managementAgreementSchema },
  VehicleIntake: { collection: 'vehicle_intakes', schema: vehicleIntakeSchema },
  VehicleListing: { collection: 'vehicle_listings', schema: vehicleListingSchema },
  Booking: { collection: 'bookings', schema: bookingSchema },
  RentalAgreement: { collection: 'rental_agreements', schema: rentalAgreementSchema },
  RentalHandover: { collection: 'rental_handovers', schema: rentalHandoverSchema },
  PaymentTransaction: { collection: 'payment_transactions', schema: paymentTransactionSchema },
  SecurityDeposit: { collection: 'security_deposits', schema: securityDepositSchema },
  OwnerSettlement: { collection: 'owner_settlements', schema: ownerSettlementSchema },
  IncidentCase: { collection: 'incident_cases', schema: incidentCaseSchema },
  VehicleWithdrawalRequest: { collection: 'vehicle_withdrawal_requests', schema: vehicleWithdrawalRequestSchema },
  PlatformPolicy: { collection: 'platform_policies', schema: platformPolicySchema },
  Notification: { collection: 'notifications', schema: notificationSchema },
  AuditLog: { collection: 'audit_logs', schema: auditLogSchema },
  SystemReport: { collection: 'system_reports', schema: systemReportSchema },
};

for (const { collection, schema } of Object.values(modelDefinitions)) {
  const definition = collections.find(({ name }) => name === collection);
  for (const field of definition.unique || []) schema.index({ [field]: 1 }, { unique: true });
  for (const key of definition.indexes || []) schema.index(key);
  for (const { key, options } of definition.indexDefinitions || []) schema.index(key, options);
}

export function getModels(connection) {
  return Object.fromEntries(Object.entries(modelDefinitions).map(([name, { collection, schema }]) => [
    name, connection.models[name] || connection.model(name, schema, collection),
  ]));
}
