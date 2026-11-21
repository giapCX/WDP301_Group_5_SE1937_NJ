import { Route, Routes } from 'react-router-dom';
import HomePage from '../pages/HomePage.jsx';
import CartPage from '../pages/CartPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="*" element={<main><h1 className="h3">Không tìm thấy trang</h1></main>} />
    </Routes>
  );
}
