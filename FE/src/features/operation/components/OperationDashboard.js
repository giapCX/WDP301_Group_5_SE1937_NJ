import Icon from '../../../components/Icon';
import { operationSections } from '../operationConfig';

const metrics = [
  ['pendingBookings', 'Booking chờ xử lý', 'calendar', 'bookings'],
  ['activeRentals', 'Xe đang cho thuê', 'car', 'bookings'],
  ['overdueRentals', 'Rental quá hạn', 'clock', 'overdue'],
  ['openIncidents', 'Sự cố đang mở', 'info', 'incidents'],
  ['openViolations', 'Vi phạm đang mở', 'shield', 'violations'],
  ['openDisputes', 'Tranh chấp đang mở', 'document', 'disputes'],
  ['openComplaints', 'Khiếu nại đang mở', 'people', 'complaints'],
];

const workload = [
  ['Booking', 'pendingBookings', 'bookings'],
  ['Sự cố', 'openIncidents', 'incidents'],
  ['Vi phạm', 'openViolations', 'violations'],
  ['Tranh chấp', 'openDisputes', 'disputes'],
  ['Khiếu nại', 'openComplaints', 'complaints'],
];

export default function OperationDashboard({ dashboard, loading, onNavigate }) {
  if (loading && !dashboard) return <div className="operation-panel">Đang tải tổng quan…</div>;

  const values = dashboard?.metrics || {};
  const maxWorkload = Math.max(1, ...Object.values(values).map(Number));

  return <>
    <section className="operation-metrics" aria-label="Chỉ số vận hành">
      {metrics.map(([key, label, icon, target]) => (
        <button className="operation-metric" key={key} onClick={() => onNavigate(target)}>
          <span><Icon name={icon} size={18} />{label}</span>
          <strong>{values[key] ?? '—'}</strong>
          <small>Xem danh sách →</small>
        </button>
      ))}
    </section>

    <section className="operation-workload operation-panel">
      <div>
        <h2>Khối lượng xử lý</h2>
        <p>Số hồ sơ đang chờ theo nhóm nghiệp vụ</p>
      </div>
      {workload.map(([label, key, target]) => {
        const value = Number(values[key] || 0);
        return (
          <button key={key} onClick={() => onNavigate(target)}>
            <span>{label}</span>
            <i><b style={{ width: `${Math.min(100, value / maxWorkload * 100)}%` }} /></i>
            <strong>{value}</strong>
          </button>
        );
      })}
    </section>

    <section className="operation-panel operation-shortcuts">
      <div><h2>Truy cập nhanh</h2><p>Chọn hàng đợi cần xử lý.</p></div>
      {operationSections.slice(1).map((item) => (
        <button key={item.id} onClick={() => onNavigate(item.id)}>
          <Icon name={item.icon} size={17} />{item.label}<span>→</span>
        </button>
      ))}
    </section>
  </>;
}
