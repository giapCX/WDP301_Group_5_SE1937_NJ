import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export default function Header() {
  const { itemCount } = useCart();

  return (
    <header className="site-header border-bottom bg-white">
      <nav className="container navbar navbar-expand-lg px-0" aria-label="Điều hướng chính">
        <Link className="navbar-brand fw-bold" to="/">SDN302 Store</Link>
        <div className="navbar-nav ms-auto flex-row gap-3">
          <NavLink className="nav-link" to="/">Trang chủ</NavLink>
          <NavLink className="nav-link" to="/cart">Giỏ hàng ({itemCount})</NavLink>
        </div>
      </nav>
    </header>
  );
}
