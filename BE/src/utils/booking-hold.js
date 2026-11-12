export const BOOKING_REVIEW_WINDOW_MS = 2 * 60 * 60 * 1000;
export const BOOKING_PAYMENT_WINDOW_MS = 15 * 60 * 1000;

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
