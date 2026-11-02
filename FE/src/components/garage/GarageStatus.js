import { statusLabels } from '../../data/garage';
export default function GarageStatus({ status, blocked = false, label }) {
  return (
    <span className={`gs-status gs-status--${blocked ? 'blocked' : status}`}>
      <i />
      {blocked ? 'Chưa đủ điều kiện' : label || statusLabels[status] || status}
    </span>
  );
}
