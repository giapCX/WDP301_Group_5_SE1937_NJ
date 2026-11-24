import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../../auth/api/authApi';
import { useState } from 'react';
import Icon from '../../bookings/components/BookingIcon';

export default function DriverSidebar() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setError('Chưa đăng xuất được. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }
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
        <button
          className="driver-signout"
          aria-label="Đăng xuất"
          disabled={busy}
          onClick={signOut}
        >
          <Icon name="arrow" />
          {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
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
