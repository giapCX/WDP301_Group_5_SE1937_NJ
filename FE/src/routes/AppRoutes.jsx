import { Navigate, Route, Routes } from 'react-router-dom';
import BookingManagementPage from '../features/bookings/pages/BookingManagementPage.jsx';
import BookingModificationPage from '../features/booking-changes/pages/BookingModificationPage.jsx';
import MainLayout from '../layouts/MainLayout.jsx';
import HomePage from '../pages/HomePage.jsx';
import CartPage from '../pages/CartPage.jsx';
import OperatorDashboard from '../pages/operator/OperatorDashboard.jsx';
import AvailableVehiclesPage from '../pages/operator/AvailableVehiclesPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/operator/dashboard" replace />} />
      <Route path="/operator/dashboard" element={<OperatorDashboard />} />
      <Route path="/operator/bookings" element={<BookingManagementPage key="dispatch" initialStatus="pending" />} />
      <Route path="/operator/booking-management" element={<BookingManagementPage key="management" initialStatus="" screen="management" />} />
      <Route path="/operator/vehicles" element={<AvailableVehiclesPage />} />
      <Route
        path="/operator/booking-change-requests"
        element={<BookingModificationPage />}
      />
      <Route
        path="/store"
        element={
          <MainLayout>
            <HomePage />
          </MainLayout>
        }
      />
      <Route
        path="/cart"
        element={
          <MainLayout>
            <CartPage />
          </MainLayout>
        }
      />
      <Route
        path="*"
        element={
          <main>
            <h1 className="h3">Không tìm thấy trang</h1>
          </main>
        }
      />
    </Routes>
  );
}
