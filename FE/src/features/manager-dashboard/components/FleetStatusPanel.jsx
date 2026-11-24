import { VEHICLE_STATUS_META } from '../managerDashboardConfig';
import { formatPercent } from '../utils/managerDashboardFormatters';

export default function FleetStatusPanel({ statuses = [], totalVehicles = 0 }) {
  const availableCount = statuses
    .filter(({ status }) => status === 'available')
    .reduce((total, item) => total + item.count, 0);
  const runningCount = statuses
    .filter(({ status }) => ['in_use', 'ongoing'].includes(status))
    .reduce((total, item) => total + item.count, 0);
  const maintenanceCount = statuses
    .filter(({ status }) => status === 'maintenance')
    .reduce((total, item) => total + item.count, 0);
  const segments = statuses.map((item) => ({
    ...item,
    width: totalVehicles ? (item.count / totalVehicles) * 100 : 0,
    color: VEHICLE_STATUS_META[item.status]?.color || '#a8b4c2',
  }));

  return (
    <section className="manager-panel fleet-status-panel">
      <div className="manager-panel-heading">
        <div><h2>Phân bổ &amp; Trạng thái đội xe</h2><p>Hiệu suất khai thác theo trạng thái phương tiện.</p></div>
        <span className="manager-panel-badge">{totalVehicles} xe</span>
      </div>
      <div className="manager-fleet-status-list">
        {segments.map((item) => <div className="manager-fleet-status-row" key={item.status}>
          <span className="manager-fleet-status-name"><i style={{ backgroundColor: item.color }}/>{VEHICLE_STATUS_META[item.status]?.label || item.status}</span>
          <b>{item.count} xe</b><small>{formatPercent(item.width)}</small>
          <span className="manager-fleet-status-track"><i style={{ width: `${item.width}%`, backgroundColor: item.color }}/></span>
        </div>)}
        {!segments.length && <div className="manager-empty-state">Chưa có xe trong hệ thống.</div>}
      </div>
      <div className="manager-realtime-status">
        <div><span>Tình trạng thực tế toàn đội (realtime)</span><strong>{totalVehicles ? formatPercent((availableCount / totalVehicles) * 100) : '0%'}</strong></div>
        <div className="manager-realtime-track">
          <i className="ready" style={{ width: `${totalVehicles ? (availableCount / totalVehicles) * 100 : 0}%` }}/>
          <i className="running" style={{ width: `${totalVehicles ? (runningCount / totalVehicles) * 100 : 0}%` }}/>
          <i className="service" style={{ width: `${totalVehicles ? (maintenanceCount / totalVehicles) * 100 : 0}%` }}/>
        </div>
        <div className="manager-realtime-legend"><span>{availableCount} sẵn sàng</span><span>{runningCount} đang chạy</span><span>{maintenanceCount} bảo dưỡng</span></div>
      </div>
    </section>
  );
}
