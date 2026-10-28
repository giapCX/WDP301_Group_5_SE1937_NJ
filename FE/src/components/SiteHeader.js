import { useEffect, useState } from 'react';
import Icon from './Icon';

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
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem('xedi_user') || sessionStorage.getItem('xedi_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleStorage = () => {
      try {
        const raw = localStorage.getItem('xedi_user') || sessionStorage.getItem('xedi_user');
        setCurrentUser(raw ? JSON.parse(raw) : null);
      } catch {
        setCurrentUser(null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('xedi_token');
    localStorage.removeItem('xedi_user');
    sessionStorage.removeItem('xedi_token');
    sessionStorage.removeItem('xedi_user');
    setCurrentUser(null);
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
        </nav>
        <div className="header-actions">
          <span className="header-reassurance">
            <Icon name="shield" size={16} /> Thuê xe minh bạch
          </span>
          {currentUser ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  maxWidth: '160px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={currentUser.full_name || currentUser.email}
              >
                👤 {currentUser.full_name || currentUser.email}
              </span>
              <button
                className="login-button"
                style={{ color: '#ef4444', cursor: 'pointer', padding: '6px 4px' }}
                onClick={handleLogout}
                title="Đăng xuất khỏi tài khoản"
              >
                (Đăng xuất)
              </button>
            </div>
          ) : (
            <button className="login-button" onClick={onLogin}>
              Đăng nhập
            </button>
          )}
          <a className="button button-primary header-host" href="#chu-xe">
            <span>＋</span> Đăng xe cho thuê
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
