import { useEffect, useState } from 'react';
import HomePage from '../features/home/pages/HomePage';
import Login from '../features/auth/pages/LoginPage';
import GaragePage from '../features/garage/pages/GaragePage';
import ManagerPage from '../features/manager/pages/ManagerPage';
import AdminPage from '../features/manager/pages/AdminPage';

export default function AppRouter() {
  const [isLogin, setIsLogin] = useState(() => window.location.hash.startsWith('#/login'));
  const isGarage = window.location.pathname.startsWith('/garage');
  const [isManager, setIsManager] = useState(() => window.location.hash.startsWith('#/manager'));
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash.startsWith('#/admin'));

  useEffect(() => {
    const onHashChange = () => {
      setIsLogin(window.location.hash.startsWith('#/login'));
      setIsManager(window.location.hash.startsWith('#/manager'));
      setIsAdmin(window.location.hash.startsWith('#/admin'));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = isGarage
      ? 'Garage Staff — XeDi'
      : isLogin
      ? 'Đăng nhập & Đăng ký — XeDi'
      : isAdmin
        ? 'Quản trị hệ thống — XeDi'
        : isManager
          ? 'Quản lý vận hành — XeDi'
        : 'XeDi — Thuê xe tự lái, vi vu mọi nẻo đường';
    window.scrollTo(0, 0);
  }, [isLogin, isManager, isAdmin, isGarage]);

  if (isGarage) return <GaragePage />;
  if (isAdmin) return <AdminPage />;
  if (isManager) return <ManagerPage />;

  return isLogin ? (
    <div className="login-page">
      <Login />
    </div>
  ) : (
    <HomePage />
  );
}
