import { ADMIN_NAVIGATION } from '../accessControlConfig';
import AccessControlIcon from './AccessControlIcon';

export default function AdminSidebar({ activeItem, onNavigate }) {
  return (
    <aside className="acl-sidebar">
      <a className="acl-brand" href="#top" aria-label="VietTour Admin">
        <span className="acl-brand-mark">V</span>
        <span><b>VIETTOUR</b><small>ADMIN PORTAL</small></span>
      </a>
      <div className="acl-workspace"><span className="workspace-dot"/> Không gian quản trị <span className="workspace-chevron">⌄</span></div>
      <div className="acl-nav-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav className="acl-nav" aria-label="Điều hướng quản trị">
        {ADMIN_NAVIGATION.map(({ label, icon }) => (
          <button key={label} type="button" onClick={() => onNavigate(label)} className={`acl-nav-item ${activeItem === label ? 'is-active' : ''}`}>
            <AccessControlIcon name={icon} size={17}/><span>{label}</span>{activeItem === label && <i/>}
          </button>
        ))}
      </nav>
      <div className="acl-sidebar-bottom">
        <button type="button" className="acl-nav-item"><AccessControlIcon name="settings" size={17}/><span>Cài đặt hệ thống</span></button>
        <div className="acl-support"><span className="support-icon">?</span><span><b>Cần hỗ trợ?</b><small>Liên hệ đội ngũ kỹ thuật</small></span><AccessControlIcon name="chevron" size={14}/></div>
      </div>
    </aside>
  );
}
