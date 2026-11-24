import { NavLink, useOutletContext } from 'react-router-dom';
import SignOutButton from '../../auth/components/SignOutButton';
import Icon from './BookingIcon';

export default function BookingSidebar() {
  const user = useOutletContext();
  return (
    <aside className="dispatch-sidebar">
      <NavLink className="dispatch-brand" to="/operator/dashboard">
        <span className="brand-mark">
          <Icon name="car" size={24} />
        </span>
        <span>
          VietTour<span className="brand-caption">ĐIỀU HÀNH VIÊN</span>
        </span>
      </NavLink>
      <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav aria-label="Điều hướng điều hành">
        <NavLink
          to="/operator/dashboard"
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <Icon name="grid" />
          Tổng quan điều hành
        </NavLink>
        <NavLink to="/operator/bookings">
          <Icon name="route" />
          Điều phối chuyến đi
        </NavLink>
        <NavLink to="/operator/trip-monitoring" aria-label="Theo dõi chuyến">
          <Icon name="pin" />
          Theo dõi chuyến
        </NavLink>
        <NavLink to="/operator/booking-change-requests" aria-label="Thay đổi lịch trình">
          <Icon name="calendar" />
          Thay đổi lịch trình
        </NavLink>
        <NavLink
          to="/operator/booking-management"
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <Icon name="list" />
          Quản lý đặt xe
        </NavLink>
        <NavLink
          to="/operator/vehicles"
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <Icon name="car" />
          Xe sẵn sàng
        </NavLink>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help">
          <Icon name="help" size={21} />
          <div>
            <strong>Cùng bạn trên mọi hành trình</strong>
            <p>Quản lý chuyến đi dễ dàng hơn.</p>
          </div>
        </div>
        <div className="sidebar-workspace">
          <span className="workspace-dot" />
          {user?.full_name || 'Tài khoản điều hành'}
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
