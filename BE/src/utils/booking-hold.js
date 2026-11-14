export const BOOKING_REVIEW_WINDOW_MS = 2 * 60 * 60 * 1000;
export const BOOKING_PAYMENT_WINDOW_MS = 15 * 60 * 1000;

export const openRentalSigningBookings = (now) => ({
  start_at: { $gt: now },
  $or: [{ status: 'awaiting_payment' }, { status: 'pending', 'review_info.required': false }],
  $expr: { $or: [{ $eq: [bookingHoldExpression, null] }, { $gt: [bookingHoldExpression, now] }] },
});

export const operatorRentalContractQueue = {
  status: 'pending_signatures',
  'contract_document.hash': { $exists: true },
  'signing_info.platform_signed_at': null,
  'signing_info.platform_signer_user_id': null,
  'operator_intake.confirmed_at': null,
  $or: [{ 'signing_info.renter_confirmed': true }, { 'signing_info.renter_signed_at': { $ne: null } }],
};

export function bookingHoldDeadline(booking) {
  return (booking.status === 'awaiting_payment' ? booking.payment_deadline_at : null) || booking.hold_expires_at;
}

export const bookingHoldExpression = {
  $cond: [
    { $eq: ['$status', 'awaiting_payment'] },
    { $ifNull: ['$payment_deadline_at', { $ifNull: ['$hold_expires_at', null] }] },
    { $ifNull: ['$hold_expires_at', null] },
  ],
};

export function isBookingHoldExpired(booking, now = new Date()) {
  const deadline = bookingHoldDeadline(booking);
  return Boolean(deadline && deadline <= now);
}
