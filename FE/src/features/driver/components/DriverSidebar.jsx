import { NavLink } from 'react-router-dom';
import SignOutButton from '../../auth/components/SignOutButton';
import Icon from '../../shared/booking/BookingIcon';

export default function DriverSidebar() {
  return (
    <aside className="dispatch-sidebar driver-sidebar">
      <NavLink
        className="dispatch-brand"
        to="/driver/dashboard"
        aria-label="VietTour Driver"
      >
        <span className="brand-mark">
          <Icon name="car" size={24} />
        </span>
        <span>
          VietTour<span className="brand-caption">KHÔNG GIAN TÀI XẾ</span>
        </span>
      </NavLink>
      <div className="sidebar-label">ĐỒNG HÀNH MỖI CHUYẾN ĐI</div>
      <nav aria-label="Điều hướng tài xế">
        <NavLink to="/driver/dashboard" aria-label="Tổng quan tài xế">
          <Icon name="grid" />
          Tổng quan tài xế
        </NavLink>
        <a href="#driver-trips" aria-label="Chuyến được phân công">
          <Icon name="route" />
          Chuyến được phân công
        </a>
        <a href="#driver-workflow" aria-label="Cập nhật thực hiện chuyến">
          <Icon name="check" />
          Thực hiện chuyến
        </a>
        <a href="#driver-profile" aria-label="Thông tin tài xế">
          <Icon name="user" />
          Thông tin tài xế
        </a>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help">
          <Icon name="help" />
          <div>
            <strong>An toàn trên từng hành trình</strong>
            <p>Kiểm tra lịch và thông tin chuyến trước khi xuất phát.</p>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
