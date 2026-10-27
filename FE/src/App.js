import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage';
import Login from './components/Login';

export default function App() {
  const [isLogin, setIsLogin] = useState(() => window.location.hash.startsWith('#/login'));

  useEffect(() => {
    const onHashChange = () => setIsLogin(window.location.hash.startsWith('#/login'));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = isLogin
      ? 'Đăng nhập & Đăng ký — XeDi'
      : 'XeDi — Thuê xe tự lái, vi vu mọi nẻo đường';
    window.scrollTo(0, 0);
  }, [isLogin]);

  return isLogin ? (
    <div className="login-page">
      <Login />
    </div>
  ) : (
    <HomePage />
  );
}
