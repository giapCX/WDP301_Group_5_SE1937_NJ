import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../../auth/api/authApi.js';
import Icon from '../../home/components/HomeIcon.js';
import { hotline } from '../../home/homeContent.js';
import '../styles/renterDashboard.css';

const dashboardPath = '/renter/dashboard';
const bookingPath = '/renter/bookings';
const newBookingPath = bookingPath + '/new';
const navigation = [
  [dashboardPath, 'Tổng quan', 'dashboard'],
  [newBookingPath, 'Đặt chuyến đi', 'directions_car'],
  [bookingPath, 'My Bookings', 'receipt_long'],
  [dashboardPath + '#chuyen-di', 'Chuyến đi hiện tại', 'route'],
  [dashboardPath + '#lich-su', 'Lịch sử chuyến đi', 'history'],
  [dashboardPath + '#uu-dai', 'Ưu đãi', 'redeem'],
];

function activeLink({ pathname, hash }) {
  if (pathname.startsWith('/vehicles') || pathname.startsWith(newBookingPath + '/')) return newBookingPath;
  return pathname === dashboardPath && hash !== '#tong-quan' ? pathname + hash : pathname;
}

export default function RenterLayout({ user, children, mainClassName = '' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const active = activeLink(location);
  const currentLabel = navigation.find(([to]) => to === active)?.[1];
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    setSigningOut(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setError('Chưa thể đăng xuất. Vui lòng thử lại.');
      setSigningOut(false);
    }
  }

  return (
    <div className="vt-r-dashboard">
      <aside className="vt-r-sidebar">
        <Link to="/" className="vt-r-brand" aria-label="Trang chủ VietTour">
          <span className="vt-r-brand-mark">V</span>
          <span><strong>VietTour</strong><small>Khu vực người thuê</small></span>
        </Link>
        <nav aria-label="Điều hướng người thuê">
          {navigation.map(([to, label, icon]) => (
            <Link key={to} to={to} aria-current={active === to ? 'location' : undefined} aria-label={label} title={label}>
              <Icon name={icon}/><span>{label}</span>
            </Link>
          ))}
        </nav>
        <a className="vt-r-support" href={hotline.href} aria-label={`Hỗ trợ hành trình, ${hotline.label}`} title="Hỗ trợ hành trình">
          <Icon name="support_agent"/><span>Hỗ trợ hành trình<strong>{hotline.label}</strong></span>
        </a>
      </aside>
      <div className="vt-r-workspace">
        <header className="vt-r-topbar">
          <div className="vt-r-breadcrumb">Người thuê <span aria-hidden="true">/</span> <strong>{currentLabel}</strong></div>
          <div className="vt-r-account">
            {user ? <>
              <span className="vt-r-avatar" aria-hidden="true">{user.full_name?.slice(0, 1).toUpperCase()}</span>
              <strong>{user.full_name}</strong>
              <button className="vt-r-button" type="button" disabled={signingOut} onClick={signOut}>Đăng xuất</button>
            </> : <Link className="vt-r-button" to="/login">Đăng nhập</Link>}
          </div>
        </header>
        <main className={`vt-r-main ${mainClassName}`.trim()}>
          {error && <p role="alert" className="vt-r-panel vt-r-error">{error}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}
