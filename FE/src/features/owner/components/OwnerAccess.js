import { clearSession } from '../../auth/session';
import useOwnerAccess from '../hooks/useOwnerAccess';

export default function OwnerAccess({ children }) {
  const { session, retry } = useOwnerAccess();

  if (session.status === 'ready') return children;

  return (
    <main className="owner-access" aria-live="polite">
      <h1>Không gian chủ xe</h1>
      {session.status === 'loading' && <p role="status">Đang kiểm tra phiên đăng nhập...</p>}
      {session.status === 'login' && <>
        <p>Vui lòng đăng nhập bằng tài khoản có quyền chủ xe.</p>
        <a href="/#/login">Đăng nhập</a>
      </>}
      {session.status === 'forbidden' && <>
        <p role="alert">Tài khoản của bạn không có quyền truy cập cổng chủ xe.</p>
        <button onClick={clearSession}>Đăng xuất để đổi tài khoản</button>
      </>}
      {session.status === 'error' && <>
        <p role="alert">{session.message}</p>
        <button onClick={retry}>Thử lại</button>
      </>}
      <p><a href="/">Về trang chủ</a></p>
    </main>
  );
}
