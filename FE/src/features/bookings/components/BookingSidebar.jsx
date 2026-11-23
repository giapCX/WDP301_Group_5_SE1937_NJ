import { NavLink } from 'react-router-dom';
import Icon from './BookingIcon';

export function DispatchSidebar({ home, caption, navigationLabel, children, footer }) {
  return (
    <aside className="dispatch-sidebar">
      <NavLink className="dispatch-brand" to={home} aria-label={`VietTour · ${caption}`}>
        <span className="brand-mark">
          <Icon name="car" size={24} />
        </span>
        <span>
          VietTour<span className="brand-caption">{caption}</span>
        </span>
      </NavLink>
      <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav aria-label={navigationLabel}>{children}</nav>
      {footer && <div className="sidebar-bottom">{footer}</div>}
    </aside>
  );
}

export default function BookingSidebar() {
  return (
    <DispatchSidebar
      home="/operator/bookings"
      caption="ĐIỀU HÀNH VIÊN"
      navigationLabel="Điều hướng điều hành"
      footer={
        <>
          <div className="sidebar-help">
            <Icon name="help" size={21} />
            <div>
              <strong>Cùng bạn trên mọi hành trình</strong>
              <p>Quản lý chuyến đi dễ dàng hơn.</p>
            </div>
          </div>
          <div className="sidebar-workspace">
            <span className="workspace-dot" />
            Trung tâm điều hành<span>V1.0</span>
          </div>
        </>
      }
    >
      <a href="/operator/bookings#overview">
        <Icon name="grid" />
        Tổng quan điều hành
      </a>
      <NavLink to="/operator/bookings">
        <Icon name="route" />
        Điều phối chuyến đi
      </NavLink>
      <NavLink to="/operator/booking-change-requests" aria-label="Thay đổi lịch trình">
        <Icon name="calendar" />
        Thay đổi lịch trình
      </NavLink>
      <a href="/operator/bookings#booking-list">
        <Icon name="list" />
        Quản lý đặt xe
      </a>
      <a href="/operator/bookings#available-vehicles">
        <Icon name="car" />
        Xe sẵn sàng
      </a>
    </DispatchSidebar>
  );
}
