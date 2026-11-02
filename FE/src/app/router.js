import { useEffect, useState } from 'react';
import HomePage from '../features/home/pages/HomePage';
import Login from '../features/auth/pages/LoginPage';
import GaragePage from '../pages/GaragePage';

export default function AppRouter() {
  const [isLogin, setIsLogin] = useState(() => window.location.hash.startsWith('#/login'));
  const isGarage = window.location.pathname.startsWith('/garage');

  useEffect(() => {
    const onHashChange = () => setIsLogin(window.location.hash.startsWith('#/login'));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = isGarage
      ? 'Garage Staff — XeDi'
      : isLogin
      ? 'Đăng nhập & Đăng ký — XeDi'
      : 'XeDi — Thuê xe tự lái, vi vu mọi nẻo đường';
    window.scrollTo(0, 0);
  }, [isLogin, isGarage]);

  if (isGarage) return <GaragePage />;

  return isLogin ? (
    <div className="login-page">
      <Login />
    </div>
  ) : (
    <HomePage />
  );
}
