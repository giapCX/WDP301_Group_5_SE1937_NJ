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
import VerificationPage from '../features/verification/pages/VerificationPage';
import OperationPage from '../features/operation/pages/OperationPage';

export default function AppRouter() {
  const [isLogin, setIsLogin] = useState(() => window.location.hash.startsWith('#/login'));
  const [isGarage, setIsGarage] = useState(() => window.location.pathname.startsWith('/garage') || window.location.hash.startsWith('#/garage'));
  const [isOwner, setIsOwner] = useState(() => window.location.pathname.startsWith('/owner') || window.location.hash.startsWith('#/owner'));
  const [isManager, setIsManager] = useState(() => window.location.hash.startsWith('#/manager'));
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash.startsWith('#/admin'));
  const [isOperations, setIsOperations] = useState(() => window.location.hash.startsWith('#/operations'));
  const [isContracts, setIsContracts] = useState(() => window.location.hash.startsWith('#/contracts'));
  const [isVerification, setIsVerification] = useState(() => window.location.hash.startsWith('#/verification'));
  const [isOperation, setIsOperation] = useState(() => window.location.hash.startsWith('#/operation'));

  useEffect(() => {
    const onHashChange = () => {
      setIsLogin(window.location.hash.startsWith('#/login'));
      setIsManager(window.location.hash.startsWith('#/manager'));
      setIsGarage(window.location.hash.startsWith('#/garage'));
      setIsOwner(window.location.hash.startsWith('#/owner'));
      setIsAdmin(window.location.hash.startsWith('#/admin'));
      setIsOperations(window.location.hash.startsWith('#/operations'));
      setIsContracts(window.location.hash.startsWith('#/contracts'));
      setIsVerification(window.location.hash.startsWith('#/verification'));
      setIsOperation(window.location.hash.startsWith('#/operation'));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = isContracts ? 'Hợp đồng — XeDi' : isOperations ? 'Xác minh sự cố — XeDi' : isGarage
      ? 'Garage Staff — XeDi'
      : isOwner
      ? 'Cổng chủ xe — XeDi'
      : isVerification
      ? 'Xác minh eKYC — XeDi'
      : isLogin
      ? 'Đăng nhập & Đăng ký — XeDi'
      : isAdmin
        ? 'Quản trị hệ thống — XeDi'
        : isOperation
          ? 'Operation Management — XeDi'
          : isManager
            ? 'Quản lý vận hành — XeDi'
            : 'XeDi — Thuê xe tự lái, vi vu mọi nẻo đường';
    window.scrollTo(0, 0);
  }, [isLogin, isManager, isAdmin, isGarage, isOwner, isOperations, isContracts, isVerification, isOperation]);

  if (isContracts) return <ContractsPage />;
  if (isGarage) return <GarageAccess>{(user) => <GaragePage user={user} />}</GarageAccess>;
  if (isOwner) return <OwnerPage />;
  if (isAdmin) return <AdminPage />;
  if (isOperation) return <OperationPage />;
  if (isManager) return <ManagerPage />;
  if (isOperations) return <OperationIncidentsPage />;
  if (isVerification) return <VerificationPage />;

  return isLogin ? (
    <div className="login-page">
      <Login />
    </div>
  ) : (
    <HomePage />
  );
}
