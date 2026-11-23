import RenterPage from '../features/renter/pages/RenterPage';
import VietTourRenterDashboard from '../features/renter/pages/VietTourRenterDashboard';
import VietTourTripSearch from '../features/renter/pages/VietTourTripSearch';
import { useEffect, useState } from 'react';
import HomePage from '../features/home/pages/HomePage';
import TravelHomePage from '../features/home/pages/TravelHomePage';
import Login from '../features/auth/pages/LoginPage';
import RoleWorkspace from '../features/auth/pages/RoleWorkspace';
import { getCurrentUser } from '../features/auth/session';
import GaragePage from '../features/garage/pages/GaragePage';
import GarageAccess from '../features/garage/components/GarageAccess';
import ManagerPage from '../features/manager/pages/ManagerPage';
import OwnerPage from '../features/owner/pages/OwnerPage';
import OwnerAccess from '../features/owner/components/OwnerAccess';
import AdminPage from '../features/admin/pages/AdminPage';
import ContractsPage from '../features/contracts/ContractsPage';
import OperatorPage from '../features/operator/pages/OperatorPage';
import VehicleDetailPage from '../features/listings/pages/VehicleDetailPage';

const isHashRoute = (hash, route) => new RegExp(`^#/${route}(?:/|$)`).test(hash);
const isStaffLoginRoute = () => window.location.hash === '#/staff-login';
const isLoginRoute = () => isHashRoute(window.location.hash, 'login') ||
  isHashRoute(window.location.hash, 'staff-login') ||
  (!window.location.hash && /^\/login\/?$/.test(window.location.pathname));

export default function AppRoutes() {
  const [renterRoute, setRenterRoute] = useState(() => isHashRoute(window.location.hash, 'renter') ? window.location.hash : '');
  const isRenter = Boolean(renterRoute);
  const [isLogin, setIsLogin] = useState(isLoginRoute);
  const [isStaffLogin, setIsStaffLogin] = useState(isStaffLoginRoute);
  const [isGarage, setIsGarage] = useState(() => window.location.pathname.startsWith('/garage') || window.location.hash.startsWith('#/garage'));
  const [isOwner, setIsOwner] = useState(() => window.location.pathname.startsWith('/owner') || window.location.hash.startsWith('#/owner'));
  const [isManager, setIsManager] = useState(() => window.location.hash.startsWith('#/manager'));
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash.startsWith('#/admin'));
  const [isDriver, setIsDriver] = useState(() => isHashRoute(window.location.hash, 'driver'));
  const [isOperations, setIsOperations] = useState(() => isHashRoute(window.location.hash, 'operations'));
  const [isContracts, setIsContracts] = useState(() => window.location.hash.startsWith('#/contracts'));
  const [isOperation, setIsOperation] = useState(() => isHashRoute(window.location.hash, 'operation'));
  const [isOperator, setIsOperator] = useState(() => isHashRoute(window.location.hash, 'operator'));
  const [vehicleId, setVehicleId] = useState(() => window.location.hash.match(/^#\/xe\/([a-f0-9]{24})(?:\?.*)?$/i)?.[1] || '');

  useEffect(() => {
    const onHashChange = () => {
      setRenterRoute(isHashRoute(window.location.hash, 'renter') ? window.location.hash : '');
      setIsLogin(isLoginRoute());
      setIsStaffLogin(isStaffLoginRoute());
      setIsManager(window.location.hash.startsWith('#/manager'));
      setIsGarage(window.location.hash.startsWith('#/garage'));
      setIsOwner(window.location.hash.startsWith('#/owner'));
      setIsAdmin(window.location.hash.startsWith('#/admin'));
      setIsDriver(isHashRoute(window.location.hash, 'driver'));
      setIsOperations(isHashRoute(window.location.hash, 'operations'));
      setIsContracts(window.location.hash.startsWith('#/contracts'));
      setIsOperation(isHashRoute(window.location.hash, 'operation'));
      setIsOperator(isHashRoute(window.location.hash, 'operator'));
      setVehicleId(window.location.hash.match(/^#\/xe\/([a-f0-9]{24})(?:\?.*)?$/i)?.[1] || '');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = isDriver ? 'Tài xế — VietTour' : renterRoute.startsWith('#/renter/dat-chuyen') ? 'Đặt chuyến — VietTour' : isRenter ? 'Khách thuê — VietTour' : isContracts ? 'Hợp đồng — XeDi' : isOperator || isOperations || isOperation ? 'Nhân viên vận hành — VietTour' : isGarage
      ? 'Nhân viên gara — VietTour'
      : isOwner
      ? 'Cổng chủ xe — XeDi'
      : isLogin
      ? 'Đăng nhập & Đăng ký — VietTour'
      : isAdmin
        ? 'Quản trị hệ thống — VietTour'
        : isManager
          ? 'Quản lý vận hành — VietTour'
          : window.location.pathname === '/xe-tu-lai'
            ? 'XeDi — Thuê xe tự lái, vi vu mọi nẻo đường'
            : 'VietTour — Thuê xe du lịch';
    window.scrollTo(0, 0);
  }, [isLogin, isManager, isAdmin, isDriver, isGarage, isOwner, isOperations, isOperator, isContracts, isOperation, isRenter, renterRoute]);

  if (isDriver) return <RoleWorkspace key="DRIVER" role="DRIVER" />;
  if (getCurrentUser()?.workspace_schema === 'viet_tour') {
    const workspaceRole = isGarage ? 'GARAGE_STAFF' : isAdmin ? 'ADMIN' :
      isManager ? 'MANAGER' : isOperator || isOperations || isOperation ? 'OPERATION_STAFF' : '';
    if (workspaceRole) return <RoleWorkspace key={workspaceRole} role={workspaceRole} />;
  }
  if (/^#\/renter\/dat-chuyen(?:\?|$)/.test(renterRoute)) return <VietTourTripSearch key={renterRoute} route={renterRoute} />;
  if (isRenter) return /^#\/renter\/?$/.test(renterRoute) ? <VietTourRenterDashboard /> : <RenterPage />;
  if (vehicleId) return <VehicleDetailPage listingId={vehicleId} />;
  if (isContracts) return <ContractsPage />;
  if (isGarage) return <GarageAccess>{(user) => <GaragePage user={user} />}</GarageAccess>;
  if (isOwner) return <OwnerAccess><OwnerPage /></OwnerAccess>;
  if (isAdmin) return <AdminPage />;
  if (isOperator || isOperations || isOperation) return <OperatorPage initialSection={isOperations ? 'incidents' : undefined} />;
  if (isManager) return <ManagerPage />;

  return isLogin ? (
    <div className="login-page">
      <Login key={isStaffLogin ? 'staff' : 'renter'} staff={isStaffLogin} />
    </div>
  ) : (
    window.location.pathname === '/xe-tu-lai' ? <HomePage /> : <TravelHomePage />
  );
}
