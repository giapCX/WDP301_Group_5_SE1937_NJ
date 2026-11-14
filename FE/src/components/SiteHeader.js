import { useEffect, useState } from 'react';
import Icon from './Icon';
import { canAccessGarage, canAccessOwner, clearSession, getCurrentUser } from '../features/auth/session';

export function Brand({ light = false }) {
  return (
    <a
      href="#trang-chu"
      className={`brand ${light ? 'brand-light' : ''}`}
      aria-label="XeDi — Trang chủ"
    >
      <span className="brand-mark">
        <Icon name="car" size={23} />
      </span>
      XeDi
    </a>
  );
}

export default function SiteHeader({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(getCurrentUser);

  useEffect(() => {
    const update = () => setCurrentUser(getCurrentUser());
    window.addEventListener('storage', update);
    window.addEventListener('xedi:session', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('xedi:session', update);
    };
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.hash = '#trang-chu';
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav
          className={`main-nav ${menuOpen ? 'is-open' : ''}`}
          aria-label="Điều hướng chính"
          onClick={() => setMenuOpen(false)}
        >
          <a className="active" href="#xe-noi-bat">
            Thuê xe
          </a>
          <a href="#chu-xe">Trở thành chủ xe</a>
          <a href="#huong-dan">Hướng dẫn</a>
          <a href="#ve-xedi">Về chúng tôi</a>
          {currentUser && <a href="/#/contracts">Hợp đồng</a>}
          {currentUser?.roles?.includes('RENTER') && <><a href="#/renter">Trang chủ của tôi</a><a href="#/renter/bookings">Chuyến đi của tôi</a><a href="#/renter/profile">Hồ sơ cá nhân</a></>}
          {canAccessOwner(currentUser) && <a href="/owner">Không gian chủ xe</a>}
          {canAccessGarage(currentUser) && <a href="/garage">Không gian gara</a>}
          {currentUser?.roles?.includes('OPERATION_STAFF') && <a href="/#/operator">Nhân viên vận hành</a>}
          {currentUser && <a href="#/verification">Xác minh eKYC</a>}
        </nav>
        <div className="header-actions">
          <span className="header-reassurance">
            <Icon name="shield" size={16} /> Thuê xe minh bạch
          </span>
          {currentUser ? (
            <div className="header-account">
              <span
                className="header-account-name"
                title={currentUser.full_name || currentUser.email}
              >
                👤 {currentUser.full_name || currentUser.email}
              </span>
              <button
                className="login-button header-logout"
                type="button"
                onClick={handleLogout}
                title="Đăng xuất khỏi tài khoản"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <button className="login-button" onClick={onLogin}>
              Đăng nhập
            </button>
          )}
          <a className="button button-primary header-host" href={canAccessOwner(currentUser) ? '/owner' : '#chu-xe'}>
            <span>＋</span> {canAccessOwner(currentUser) ? 'Không gian chủ xe' : 'Đăng xe cho thuê'}
          </a>
          <button
            className="icon-button mobile-menu"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
    </header>
  );
}
