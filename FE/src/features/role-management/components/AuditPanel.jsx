import { DEMO_AUDIT_EVENTS } from '../data/accessControlDemoData';
import AccessControlIcon from './AccessControlIcon';

const EVENT_ICONS = { success: 'check', info: 'users', warning: 'lock' };

export default function AuditPanel({ events = DEMO_AUDIT_EVENTS, onViewAll }) {
  return (
    <article className="acl-panel audit-panel">
      <div className="bottom-panel-heading"><div><h2>Nhật ký kiểm toán</h2><p>Hoạt động mẫu gần đây</p></div><button type="button" className="icon-tool" aria-label="Xem thêm nhật ký" onClick={onViewAll}><AccessControlIcon name="more" size={18}/></button></div>
      <div className="audit-list">{events.map((event) => <div className="audit-event" key={event.id}>
        <span className={`audit-marker ${event.type}`}><AccessControlIcon name={EVENT_ICONS[event.type] || 'check'} size={13}/></span>
        <div><b>{event.title}</b><small>{event.actor} · {event.time}</small></div>
      </div>)}</div>
      <button type="button" className="audit-link" onClick={onViewAll}>Xem toàn bộ nhật ký <AccessControlIcon name="chevron" size={13}/></button>
    </article>
  );
}
