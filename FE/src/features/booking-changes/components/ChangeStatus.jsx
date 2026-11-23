import { CHANGE_STATUSES } from '../changeConstants';

export default function ChangeStatus({ status }) {
  const item = CHANGE_STATUSES.find((value) => value.key === status);
  return (
    <span className={`booking-status tone-${item?.tone || 'gray'}`}>
      <i />
      {item?.label || status}
    </span>
  );
}
