// Collection names follow the group's JSON dataset. Indexes enforce only
// identifiers and the one-document-per-booking rules used in that dataset.
export const collections = [
  { name: 'roles', unique: ['code'] },
  { name: 'users', unique: ['email'], indexes: [{ primary_role_id: 1 }] },
  { name: 'vehicles', unique: ['license_plate'], indexes: [{ owner_id: 1 }, { onboarding_status: 1 }] },
  { name: 'vehicle_inspections', indexes: [{ vehicle_id: 1, inspected_at: -1 }] },
  { name: 'management_agreements', unique: ['agreement_number'], indexes: [{ vehicle_id: 1, status: 1 }] },
  { name: 'vehicle_intakes', indexes: [{ vehicle_id: 1, received_at: -1 }] },
  { name: 'vehicle_listings', indexes: [{ status: 1, daily_price: 1 }, { vehicle_id: 1 }] },
  { name: 'bookings', unique: ['booking_code'], indexes: [{ renter_id: 1, created_at: -1 }, { vehicle_id: 1, status: 1, start_at: 1, end_at: 1 }] },
  { name: 'rental_agreements', unique: ['contract_number', 'booking_id'] },
  { name: 'rental_handovers', indexes: [{ booking_id: 1, handover_type: 1 }] },
  { name: 'payment_transactions', unique: ['idempotency_key'], indexes: [{ booking_id: 1, created_at: -1 }] },
  { name: 'security_deposits', unique: ['booking_id'] },
  { name: 'owner_settlements', indexes: [{ owner_id: 1, period_start: -1 }] },
  { name: 'incident_cases', unique: ['case_number'], indexes: [{ booking_id: 1 }, { status: 1, assigned_operation_staff_id: 1 }] },
  { name: 'vehicle_withdrawal_requests', indexes: [{ vehicle_id: 1, status: 1 }] },
  { name: 'platform_policies', indexes: [{ policy_type: 1, status: 1, effective_from: -1 }] },
  { name: 'notifications', indexes: [{ recipient_user_id: 1, is_read: 1, created_at: -1 }] },
  { name: 'audit_logs', indexes: [{ entity_type: 1, entity_id: 1, created_at: -1 }] },
];

export async function initializeCollections(database) {
  const existing = new Set((await database.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
  for (const { name, unique = [], indexes = [] } of collections) {
    if (!existing.has(name)) {
      await database.createCollection(name);
    }
    for (const field of unique) {
      await database.collection(name).createIndex({ [field]: 1 }, { unique: true });
    }
    for (const index of indexes) {
      await database.collection(name).createIndex(index);
    }
  }
}
