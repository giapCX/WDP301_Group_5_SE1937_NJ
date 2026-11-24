import { ALERT_TYPE_META } from '../managerDashboardConfig';
import { formatDate } from '../utils/managerDashboardFormatters';
import ManagerIcon from './ManagerIcon';

function OperationCard({ id, title, description, icon, tone, items, emptyMessage, renderItem }) {
  return (
    <section id={id} className={`manager-panel manager-operation-card ${tone}`}>
      <div className="manager-operation-heading">
        <span className="manager-operation-icon"><ManagerIcon name={icon} size={17}/></span>
        <div><h2>{title}</h2><p>{description}</p></div>
        <span className="manager-operation-count">{items.length}</span>
      </div>
      {items.length
        ? <ul className="manager-operation-list">{items.slice(0, 2).map(renderItem)}</ul>
        : <div className="manager-operation-empty">{emptyMessage}</div>}
    </section>
  );
}

export default function AlertsPanel({ alerts = [], drivers = [], pendingApprovals = [] }) {
  const maintenance = alerts.filter((alert) => alert.type === 'maintenance');
  const incidents = alerts.filter((alert) => alert.type === 'incident');
  const approvalsAndIncidents = [
    ...pendingApprovals.map((vehicle) => ({ id: `approval-${vehicle.vehicle_id}`, label: vehicle.plate_number || vehicle.model || `Xe #${vehicle.vehicle_id}`, detail: vehicle.approval_status || vehicle.status })),
    ...incidents.map((incident) => ({ id: incident.id, label: incident.title, detail: `${ALERT_TYPE_META.incident.label} · ${formatDate(incident.createdAt)}` })),
  ];

  return (
    <section className="manager-operations-overview" id="manager-alerts" aria-label="Cảnh báo và công việc vận hành">
      <OperationCard id="manager-alerts" title="Cảnh báo bảo dưỡng định kỳ" description="Xe đang có phiếu bảo dưỡng cần theo dõi." icon="wrench" tone="warning" items={maintenance} emptyMessage="Không có lịch bảo dưỡng đang mở." renderItem={(item) => <li key={item.id}><b>{item.title}</b><span>Xe #{item.vehicleId} · {formatDate(item.createdAt)}</span></li>}/>
      <OperationCard id="manager-driver-performance" title="Trạng thái đội ngũ tài xế" description="Danh sách hồ sơ tài xế và tình trạng sẵn sàng." icon="users" tone="teal" items={drivers} emptyMessage="Chưa có hồ sơ tài xế." renderItem={(driver) => <li key={driver.id}><b>{driver.name || `Tài xế #${driver.id}`}</b><span>{driver.availability}{driver.licenseExpiry ? ` · Hạn bằng ${formatDate(driver.licenseExpiry)}` : ''}</span></li>}/>
      <OperationCard id="manager-approvals" title="Phê duyệt &amp; sự cố vận hành" description="Hồ sơ xe chờ duyệt và sự cố chưa xử lý." icon="check" tone="blue" items={approvalsAndIncidents} emptyMessage="Không có hồ sơ chờ duyệt hoặc sự cố mới." renderItem={(item) => <li key={item.id}><b>{item.label}</b><span>{item.detail}</span></li>}/>
    </section>
  );
}
