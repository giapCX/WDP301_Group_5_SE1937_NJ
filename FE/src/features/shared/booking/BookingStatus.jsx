import { BOOKING_STATUSES } from './bookingConstants';

export default function BookingStatus({ status }) {
  const value = BOOKING_STATUSES[status] || { label: status, tone: 'gray' };
  return <DispatchStatus label={value.label} tone={value.tone} />;
}

export function DispatchStatus({ label, tone }) {
  return (
    <span className={`booking-status tone-${tone}`}>
      <i />
      {label}
    </span>
  );
}
