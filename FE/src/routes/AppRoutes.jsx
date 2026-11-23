import { Route, Routes } from 'react-router-dom';
import BookingManagementPage from '../features/bookings/pages/BookingManagementPage.jsx';
import BookingModificationPage from '../features/booking-changes/pages/BookingModificationPage.jsx';
import MainLayout from '../layouts/MainLayout.jsx';
import HomePage from '../pages/HomePage.jsx';
import CartPage from '../pages/CartPage.jsx';
import VietTourHomePage from '../features/home/pages/VietTourHomePage.js';
import LoginPage from '../features/auth/pages/LoginPage.js';
import RequireRole from '../features/auth/components/RequireRole.js';
import RenterDashboardPage from '../features/renter-dashboard/pages/RenterDashboardPage.js';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<VietTourHomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireRole role="renter" />}>
        <Route path="/renter/dashboard" element={<RenterDashboardPage />} />
      </Route>
      <Route element={<RequireRole role="operator" />}>
        <Route path="/operator/bookings" element={<BookingManagementPage />} />
        <Route path="/operator/booking-change-requests" element={<BookingModificationPage />} />
      </Route>
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
