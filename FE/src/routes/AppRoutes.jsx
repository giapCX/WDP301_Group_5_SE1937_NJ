import { Navigate, Route, Routes } from 'react-router-dom';
import BookingManagementPage from '../features/bookings/pages/BookingManagementPage.jsx';
import BookingModificationPage from '../features/booking-changes/pages/BookingModificationPage.jsx';
import RequireRole from '../features/auth/components/RequireRole.js';
import LoginPage from '../features/auth/pages/LoginPage.js';
import VietTourHomePage from '../features/home/pages/VietTourHomePage.js';
import RenterDashboardPage from '../features/renter-dashboard/pages/RenterDashboardPage.jsx';
import VehicleCatalogPage from '../features/renter-reservations/pages/VehicleCatalogPage.jsx';
import VehicleDetailsPage from '../features/renter-reservations/pages/VehicleDetailsPage.jsx';
import TripPlannerPage from '../features/renter-reservations/pages/TripPlannerPage.jsx';
import MyBookingsPage from '../features/renter-reservations/pages/MyBookingsPage.jsx';
import RolePermissionManagementPage from '../features/role-management/pages/RolePermissionManagementPage.jsx';
import ManagerDashboardPage from '../features/manager-dashboard/pages/ManagerDashboardPage.jsx';
import MaintenanceApprovalsPage from '../features/manager-dashboard/pages/MaintenanceApprovalsPage.jsx';
import { MAINTENANCE_APPROVALS_PATH } from '../features/manager-dashboard/managerDashboardConfig.js';
import GarageLayout from '../features/garage/components/GarageLayout.jsx';
import GarageDashboardPage from '../features/garage/pages/GarageDashboardPage.jsx';
import GarageTaskPage from '../features/garage/pages/GarageTaskPage.jsx';
import MainLayout from '../layouts/MainLayout.jsx';
import HomePage from '../pages/HomePage.jsx';
import CartPage from '../pages/CartPage.jsx';
import OperatorDashboard from '../pages/operator/OperatorDashboard.jsx';
import AvailableVehiclesPage from '../pages/operator/AvailableVehiclesPage.jsx';
import DriverDashboardPage from '../features/driver/pages/DriverDashboardPage.jsx';
import TripMonitoringPage from '../features/trip-monitoring/pages/TripMonitoringPage.jsx';
import TripDispatchPage from '../features/trip-workflow/pages/TripDispatchPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<VietTourHomePage />} />
      <Route path="/vehicles" element={<VehicleCatalogPage />} />
      <Route path="/vehicles/:vehicleId" element={<VehicleDetailsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Navigate to="/login?mode=register" replace />} />
      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin/roles-permissions" element={<RolePermissionManagementPage />} />
        <Route path="/admin/permissions" element={<Navigate to="/admin/roles-permissions" replace />} />
      </Route>
      <Route element={<RequireRole role="driver" />}>
        <Route path="/driver/dashboard" element={<DriverDashboardPage />} />
      </Route>
      <Route element={<RequireRole role="manager" />}>
        <Route path="/manager/dashboard" element={<ManagerDashboardPage />} />
        <Route path={MAINTENANCE_APPROVALS_PATH} element={<MaintenanceApprovalsPage />} />
        <Route path="/manager" element={<Navigate to="/manager/dashboard" replace />} />
        <Route path="/manager/:section" element={<ManagerDashboardPage />} />
      </Route>
      <Route element={<RequireRole role="renter" />}>
        <Route path="/renter/dashboard" element={<RenterDashboardPage />} />
        <Route path="/renter/bookings" element={<MyBookingsPage />} />
        <Route path="/renter/bookings/new" element={<TripPlannerPage />} />
        <Route path="/renter/bookings/new/:vehicleId" element={<Navigate to="/renter/bookings/new" replace />} />
      </Route>
      <Route element={<RequireRole role="garage_staff" />}>
        <Route path="/garage" element={<GarageLayout />}>
          <Route index element={<Navigate to="tasks" replace />} />
          <Route path="tasks" element={<GarageDashboardPage />} />
          <Route path="tasks/:taskId/:vehicleId" element={<GarageTaskPage />} />
        </Route>
      </Route>
      <Route element={<RequireRole role="operator" />}>
        <Route path="/operator/dashboard" element={<OperatorDashboard />} />
        <Route path="/operator/trip-monitoring" element={<TripMonitoringPage />} />
        <Route path="/operator/dispatch" element={<TripDispatchPage />} />
        <Route path="/operator/vehicles" element={<AvailableVehiclesPage />} />
        <Route path="/operator/booking-management" element={<BookingManagementPage key="management" initialStatus="" screen="management" />} />
        <Route path="/operator/bookings" element={<BookingManagementPage />} />
        <Route path="/operator/booking-change-requests" element={<BookingModificationPage />} />
      </Route>
      <Route path="/store" element={<MainLayout><HomePage /></MainLayout>} />
      <Route path="/cart" element={<MainLayout><CartPage /></MainLayout>} />
      <Route path="*" element={<main><h1 className="h3">Không tìm thấy trang</h1></main>} />
    </Routes>
  );
}
