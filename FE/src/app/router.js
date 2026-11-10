import { useEffect, useState } from 'react';
import HomePage from '../features/home/pages/HomePage';
import Login from '../features/auth/pages/LoginPage';
import GaragePage from '../features/garage/pages/GaragePage';
import ManagerPage from '../features/manager/pages/ManagerPage';
import OperationPage from '../features/operation/pages/OperationPage';

export default function AppRouter() {
  const [isLogin, setIsLogin] = useState(() => window.location.hash.startsWith('#/login'));
  const isGarage = window.location.pathname.startsWith('/garage');
  const [isManager, setIsManager] = useState(() => window.location.hash.startsWith('#/manager'));
  const [isOperation, setIsOperation] = useState(() => window.location.hash.startsWith('#/operation'));

  useEffect(() => {
    const onHashChange = () => {
      setIsLogin(window.location.hash.startsWith('#/login'));
      setIsManager(window.location.hash.startsWith('#/manager'));
      setIsOperation(window.location.hash.startsWith('#/operation'));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = isGarage
      ? 'Garage Staff — XeDi'
      : isLogin
      ? 'Đăng nhập & Đăng ký — XeDi'
      : isManager
        ? 'Quản lý vận hành — XeDi'
        : isOperation
          ? 'Operation Management — XeDi'
        : 'XeDi — Thuê xe tự lái, vi vu mọi nẻo đường';
    window.scrollTo(0, 0);
  }, [isLogin, isManager, isOperation, isGarage]);

  if (isGarage) return <GaragePage />;
  if (isManager) return <ManagerPage />;
  if (isOperation) return <OperationPage />;

  return isLogin ? (
    <div className="login-page">
      <Login />
    </div>
  ) : (
    <HomePage />
  );
}
