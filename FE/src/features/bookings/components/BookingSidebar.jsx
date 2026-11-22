import { NavLink } from 'react-router-dom';
import Icon from './BookingIcon';

export default function BookingSidebar() {
  return (
    <aside className="dispatch-sidebar">
      <NavLink className="dispatch-brand" to="/operator/bookings">
        <span className="brand-mark">
          <Icon name="car" size={24} />
        </span>
        <span>
          VietTour<span className="brand-caption">ĐIỀU HÀNH VIÊN</span>
        </span>
      </NavLink>
      <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav aria-label="Điều hướng điều hành">
        <a href="#overview">
          <Icon name="grid" />
          Tổng quan điều hành
        </a>
        <NavLink to="/operator/bookings">
          <Icon name="route" />
          Điều phối chuyến đi
        </NavLink>
        <a href="#booking-list">
          <Icon name="list" />
          Quản lý đặt xe
        </a>
        <a href="#available-vehicles">
          <Icon name="car" />
          Xe sẵn sàng
        </a>
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
          Trung tâm điều hành<span>V1.0</span>
        </div>
      </div>
    </aside>
  );
}
