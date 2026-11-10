import { useEffect, useRef, useState } from 'react';
import { clearSession } from '../../auth/session';
import './UserMenu.css';

export default function UserMenu({ user, roleLabel }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const name = user?.full_name || (roleLabel === 'Admin' ? 'Quản trị viên' : 'Quản lý XeDi');
  const initial = name.trim().charAt(0).toUpperCase() || 'X';

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (root.current && !root.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const logout = () => {
    clearSession();
    window.location.hash = '#trang-chu';
  };

  return <div className="manager-account-control" ref={root}>
    <button className="manager-top-user" type="button" aria-label="Mở menu tài khoản" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span>{initial}</span>
    </button>
    {open && <div className="manager-account-menu" role="menu">
      <div className="manager-account-summary"><strong>{name}</strong><span>{user?.email || roleLabel}</span></div>
      <button type="button" role="menuitem" onClick={logout}><span aria-hidden="true">↪</span> Đăng xuất</button>
    </div>}
  </div>;
}
