import { BOOKING_STATUSES } from '../bookingConstants';

export default function BookingStatus({ status }) {
  const value = BOOKING_STATUSES[status] || { label: status, tone: 'gray' };
  return (
    <span className={`booking-status tone-${value.tone}`}>
      <i />
      {value.label}
    </span>
  );
}
