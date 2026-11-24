import ManagerIcon from './ManagerIcon';

export default function MetricCard({ label, value, detail, icon, tone, progress }) {
  return (
    <article className="manager-metric-card">
      <div className="manager-metric-top"><span>{label}</span><span className={`manager-metric-icon ${tone}`}><ManagerIcon name={icon} size={17}/></span></div>
      <strong>{value}</strong>
      <div className="manager-metric-detail">{detail}</div>
      {Number.isFinite(progress) && <div className="manager-metric-progress"><span style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}/></div>}
    </article>
  );
}
