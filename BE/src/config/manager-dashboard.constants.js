const ACTIVE_BOOKING_STATUSES = new Set(['confirmed', 'ongoing', 'in_progress']);
const CLOSED_BOOKING_STATUSES = new Set(['cancelled', 'rejected']);
const PAID_PAYMENT_STATUSES = new Set(['paid', 'completed']);
const CLOSED_MAINTENANCE_STATUSES = new Set(['completed', 'cancelled', 'closed']);
const CLOSED_INCIDENT_STATUSES = new Set(['resolved', 'closed', 'cancelled']);
const MAX_ALERTS = 6;

module.exports = {
  ACTIVE_BOOKING_STATUSES,
  CLOSED_BOOKING_STATUSES,
  CLOSED_INCIDENT_STATUSES,
  CLOSED_MAINTENANCE_STATUSES,
  MAX_ALERTS,
  PAID_PAYMENT_STATUSES,
};
