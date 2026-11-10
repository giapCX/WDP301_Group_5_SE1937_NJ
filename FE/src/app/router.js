import { useEffect, useState } from 'react';
import HomePage from '../features/home/pages/HomePage';
import Login from '../features/auth/pages/LoginPage';
import GaragePage from '../features/garage/pages/GaragePage';
import GarageAccess from '../features/garage/components/GarageAccess';
import ManagerPage from '../features/manager/pages/ManagerPage';
import OwnerPage from '../features/owner/pages/OwnerPage';
import AdminPage from '../features/manager/pages/AdminPage';
import OperationIncidentsPage from '../features/operations/pages/OperationIncidentsPage';
import ContractsPage from '../features/contracts/ContractsPage';

export default function AppRouter() {
  const [isLogin, setIsLogin] = useState(() => window.location.hash.startsWith('#/login'));
  const [isGarage, setIsGarage] = useState(() => window.location.pathname.startsWith('/garage') || window.location.hash.startsWith('#/garage'));
  const [isOwner, setIsOwner] = useState(() => window.location.pathname.startsWith('/owner') || window.location.hash.startsWith('#/owner'));
  const [isManager, setIsManager] = useState(() => window.location.hash.startsWith('#/manager'));
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash.startsWith('#/admin'));
  const [isOperations, setIsOperations] = useState(() => window.location.hash.startsWith('#/operations'));
  const [isContracts, setIsContracts] = useState(() => window.location.hash.startsWith('#/contracts'));

  useEffect(() => {
    const onHashChange = () => {
      setIsLogin(window.location.hash.startsWith('#/login'));
      setIsManager(window.location.hash.startsWith('#/manager'));
      setIsGarage(window.location.hash.startsWith('#/garage'));
      setIsOwner(window.location.hash.startsWith('#/owner'));
      setIsAdmin(window.location.hash.startsWith('#/admin'));
      setIsOperations(window.location.hash.startsWith('#/operations'));
      setIsContracts(window.location.hash.startsWith('#/contracts'));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = isContracts ? 'Hợp đồng — XeDi' : isOperations ? 'Xác minh sự cố — XeDi' : isGarage
      ? 'Garage Staff — XeDi'
      : isOwner
      ? 'Cổng chủ xe — XeDi'
      : isLogin
      ? 'Đăng nhập & Đăng ký — XeDi'
      : isAdmin
        ? 'Quản trị hệ thống — XeDi'
        : isManager
          ? 'Quản lý vận hành — XeDi'
        : 'XeDi — Thuê xe tự lái, vi vu mọi nẻo đường';
    window.scrollTo(0, 0);
  }, [isLogin, isManager, isAdmin, isGarage, isOwner, isOperations, isContracts]);

  if (isContracts) return <ContractsPage />;
  if (isGarage) return <GarageAccess>{(user) => <GaragePage user={user} />}</GarageAccess>;
  if (isOwner) return <OwnerPage />;
  if (isAdmin) return <AdminPage />;
  if (isManager) return <ManagerPage />;
  if (isOperations) return <OperationIncidentsPage />;

  return isLogin ? (
    <div className="login-page">
      <Login />
    </div>
  ) : (
    <HomePage />
  );
}
