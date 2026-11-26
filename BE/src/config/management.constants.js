const { ROLE_NAMES } = require('./role.constants');
const MANAGEMENT_ROLES = Object.freeze({ ADMIN: ROLE_NAMES.ADMIN, MANAGER: ROLE_NAMES.MANAGER, OPERATOR: ROLE_NAMES.OPERATOR });
const { APPROVAL_STATUSES } = require('./workflow.constants');
const RESOURCE_ID_FIELDS = Object.freeze({
  users: 'user_id', roles: 'role_id', vehicles: 'vehicle_id', driver_profiles: 'driver_id',
  pricing_rules: 'rule_id', service_policies: 'policy_id',
});
const RESOURCE_PERMISSIONS = Object.freeze({
  GET: Object.freeze({ users: 'account.read', roles: 'role.assign', vehicles: 'vehicle.read', driver_profiles: 'driver.read',
    pricing_rules: 'pricing.manage', service_policies: 'policy.manage', reports: 'report.read', audit_logs: 'audit.read' }),
  POST: Object.freeze({ users: 'account.write', roles: 'role.assign', vehicles: 'vehicle.write', driver_profiles: 'driver.write',
    pricing_rules: 'pricing.manage', service_policies: 'policy.manage' }),
});
const VEHICLE_REQUIRED_DOCUMENTS = Object.freeze(['registration', 'insurance', 'inspection']);
const VEHICLE_SUMMARY_FIELDS = 'vehicle_id plate_number brand model status -_id';

module.exports = {
  APPROVAL_STATUSES, MANAGEMENT_ROLES, RESOURCE_ID_FIELDS, RESOURCE_PERMISSIONS,
  VEHICLE_REQUIRED_DOCUMENTS, VEHICLE_SUMMARY_FIELDS,
};
