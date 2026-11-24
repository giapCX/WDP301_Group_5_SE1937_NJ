import { NavLink, useOutletContext } from 'react-router-dom';
import Icon from './BookingIcon';

export function DispatchSidebar({ home, caption, navigationLabel, children, footer }) {
  return (
    <aside className="dispatch-sidebar">
      <NavLink className="dispatch-brand" to={home} aria-label={`VietTour · ${caption}`}>
        <span className="brand-mark"><Icon name="car" size={24} /></span>
        <span>VietTour<span className="brand-caption">{caption}</span></span>
      </NavLink>
      <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav aria-label={navigationLabel}>{children}</nav>
      {footer && <div className="sidebar-bottom">{footer}</div>}
    </aside>
  );
}

export default function BookingSidebar() {
  const user = useOutletContext();
  return (
    <DispatchSidebar
      home="/operator/dashboard"
      caption="ĐIỀU HÀNH VIÊN"
      navigationLabel="Điều hướng điều hành"
      footer={
        <>
          <div className="sidebar-help">
            <Icon name="help" size={21} />
            <div><strong>Cùng bạn trên mọi hành trình</strong><p>Quản lý chuyến đi dễ dàng hơn.</p></div>
          </div>
          <div className="sidebar-workspace">
            <span className="workspace-dot" />
            {user?.full_name || 'Tài khoản điều hành'}
          </div>
        </>
      }
    >
      <NavLink to="/operator/dashboard"><Icon name="grid" />Tổng quan điều hành</NavLink>
      <NavLink to="/operator/bookings"><Icon name="route" />Điều phối chuyến đi</NavLink>
      <NavLink to="/operator/trip-monitoring" aria-label="Theo dõi chuyến"><Icon name="pin" />Theo dõi chuyến</NavLink>
      <NavLink to="/operator/dispatch" aria-label="Phân công chuyến"><Icon name="car" />Phân công tài xế</NavLink>
      <NavLink to="/operator/booking-change-requests" aria-label="Thay đổi lịch trình"><Icon name="calendar" />Thay đổi lịch trình</NavLink>
      <NavLink to="/operator/booking-management"><Icon name="list" />Quản lý đặt xe</NavLink>
      <NavLink to="/operator/vehicles"><Icon name="car" />Xe sẵn sàng</NavLink>
    </DispatchSidebar>
  );
}
