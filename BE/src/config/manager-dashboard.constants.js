const CLOSED_BOOKING_STATUSES = new Set(['cancelled', 'rejected']);
const PAID_PAYMENT_STATUSES = new Set(['paid', 'completed']);

module.exports = {
  CLOSED_BOOKING_STATUSES,
  PAID_PAYMENT_STATUSES,
};
