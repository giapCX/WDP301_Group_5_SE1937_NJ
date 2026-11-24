import { NavLink } from 'react-router-dom';
import useSignOut from '../../auth/hooks/useSignOut';
import Icon from '../../bookings/components/BookingIcon';

export default function DriverSidebar() {
  const { error, signingOut, signOut } = useSignOut();
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
        <button
          className="driver-signout"
          aria-label="Đăng xuất"
          type="button"
          disabled={signingOut}
          onClick={signOut}
        >
          <Icon name="arrow" />
          {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </button>
        {error && (
          <p className="driver-signout-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </aside>
  );
}
