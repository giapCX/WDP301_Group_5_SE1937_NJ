import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage';
import Login from './components/Login';
import ManagerPage from './pages/ManagerPage';

export default function App() {
  const [isLogin, setIsLogin] = useState(() => window.location.hash.startsWith('#/login'));
  const [isManager, setIsManager] = useState(() => window.location.hash.startsWith('#/manager'));

  useEffect(() => {
    const onHashChange = () => {
      setIsLogin(window.location.hash.startsWith('#/login'));
      setIsManager(window.location.hash.startsWith('#/manager'));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = isLogin
      ? 'Đăng nhập & Đăng ký — XeDi'
      : isManager
        ? 'Quản lý vận hành — XeDi'
        : 'XeDi — Thuê xe tự lái, vi vu mọi nẻo đường';
    window.scrollTo(0, 0);
  }, [isLogin, isManager]);

  return isLogin ? (
    <div className="login-page">
      <Login />
    </div>
  ) : isManager ? (
    <ManagerPage />
  ) : (
    <HomePage />
  );
}
