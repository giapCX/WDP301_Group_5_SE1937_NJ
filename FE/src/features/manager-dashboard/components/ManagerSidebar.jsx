import { useState } from 'react';
import { MANAGER_NAVIGATION } from '../managerDashboardConfig';
import ManagerIcon from './ManagerIcon';

export default function ManagerSidebar({ activeHref }) {
  const [activeItem, setActiveItem] = useState(activeHref);
  return (
    <aside className="manager-sidebar">
      <a className="manager-brand" href="/" aria-label="VietTour Mobility">
        <span className="manager-brand-mark">V</span>
        <span><b>VietTour Mobility</b><small>QUẢN TRỊ ĐỘI XE</small></span>
      </a>
      <div className="manager-nav-caption">PHÂN HỆ ĐIỀU HÀNH</div>
      <nav className="manager-nav" aria-label="Điều hướng Manager">
        {MANAGER_NAVIGATION.map((item) => <a key={item.href} className={`manager-nav-link ${activeItem === item.href ? 'active' : ''}`} aria-current={activeItem === item.href ? 'page' : undefined}
          href={!activeHref.startsWith('#') && item.href.startsWith('#') ? '/manager/dashboard' + item.href : item.href}
          onClick={() => setActiveItem(item.href)}>
          <ManagerIcon name={item.icon} size={16}/><span>{item.label}</span>{activeItem === item.href && <i/>}
        </a>)}
      </nav>
      <div className="manager-sidebar-bottom">
        <div className="manager-online"><i/> Đang kết nối hệ thống</div>
        <div className="manager-help"><span>?</span><div><b>Trung tâm hỗ trợ</b><small>Bộ phận kỹ thuật 24/7</small></div></div>
      </div>
    </aside>
  );
}
