import { NavLink } from 'react-router-dom';
import { MANAGER_NAVIGATION } from '../managerDashboardConfig';
import ManagerIcon from './ManagerIcon';

export default function ManagerSidebar() {
  return (
    <aside className="manager-sidebar">
      <a className="manager-brand" href="/" aria-label="VietTour Mobility">
        <span className="manager-brand-mark">V</span>
        <span><b>VietTour Mobility</b><small>ĐIỀU HÀNH DỊCH VỤ</small></span>
      </a>
      <div className="manager-nav-caption">PHÂN HỆ ĐIỀU HÀNH</div>
      <nav className="manager-nav" aria-label="Điều hướng Manager">
        {MANAGER_NAVIGATION.map((item) => <NavLink key={item.href} className={({ isActive }) => `manager-nav-link ${isActive ? 'active' : ''}`} end to={item.href}>
          {({ isActive }) => <><ManagerIcon name={item.icon} size={16}/><span>{item.label}</span>{isActive && <i/>}</>}
        </NavLink>)}
      </nav>
      <div className="manager-sidebar-bottom">
        <div className="manager-online"><i/> Đang kết nối hệ thống</div>
        <div className="manager-help"><span>?</span><div><b>Trung tâm hỗ trợ</b><small>Bộ phận kỹ thuật 24/7</small></div></div>
      </div>
    </aside>
  );
}
