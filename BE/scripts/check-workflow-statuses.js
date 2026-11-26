const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const workflow = require('../src/config/workflow.constants');
const STATUS_FIELDS = Object.freeze({
  bookings: ['booking_status', new Set(workflow.BOOKING_STATUSES)],
  payments: ['payment_status', new Set(workflow.PAYMENT_STATUSES)],
  refunds: ['refund_status', new Set(workflow.REFUND_STATUSES)],
  incidents: ['incident_status', new Set(workflow.INCIDENT_STATUSES)],
  maintenance_records: ['maintenance_status', new Set(workflow.MAINTENANCE_STATUSES)],
  users: ['status', new Set(workflow.USER_STATUSES)],
  vehicles: ['status', new Set(workflow.VEHICLE_STATUSES)],
  driver_profiles: ['availability_status', new Set(workflow.DRIVER_AVAILABILITY_STATUSES)],
  trip_assignments: ['assignment_status', new Set(workflow.ASSIGNMENT_STATUSES)],
  vehicle_handovers: ['status', new Set(workflow.HANDOVER_STATUSES)],
  pricing_rules: ['status', new Set(Object.values(workflow.CONFIGURATION_STATUSES))],
  service_policies: ['status', new Set(Object.values(workflow.CONFIGURATION_STATUSES))],
  trip_workflows: ['stage', new Set(workflow.TRIP_WORKFLOW_STAGES)],
  trip_status_updates: ['trip_status', new Set(workflow.TRIP_UPDATE_TYPES)],
});

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI in BE/.env');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const invalid = [];
  for (const [collectionName, [field, allowed]] of Object.entries(STATUS_FIELDS)) {
    for await (const row of db.collection(collectionName).find({}, { projection: { _id: 0, [field]: 1,
      user_id: 1, vehicle_id: 1, driver_id: 1, assignment_id: 1, booking_id: 1, payment_id: 1, refund_id: 1,
      incident_id: 1, maintenance_id: 1, policy_id: 1, rule_id: 1, inspection_id: 1, update_id: 1 } })) {
      if (row[field] !== undefined && !allowed.has(row[field])) invalid.push({ collection: collectionName,
        id: row.user_id ?? row.vehicle_id ?? row.driver_id ?? row.assignment_id ?? row.booking_id ?? row.payment_id ?? row.refund_id ?? row.incident_id ?? row.maintenance_id ?? row.policy_id ?? row.rule_id ?? row.inspection_id ?? row.update_id,
        field, value: row[field] });
    }
  }
  if (invalid.length) {
    console.error(JSON.stringify(invalid, null, 2));
    throw new Error(`Found ${invalid.length} legacy status value(s). Map them before using the stricter enums.`);
  }
  console.log('All checked workflow statuses match shared enums. No database changes made.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
