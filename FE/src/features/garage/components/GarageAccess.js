import { clearSession } from '../../auth/session';
import useGarageAccess from '../hooks/useGarageAccess';

export default function GarageAccess({ children }) {
  const { session, retry } = useGarageAccess();

  if (session.status === 'ready') return children(session.user);
  return (
    <main className="gs-access" aria-live="polite">
      <h1>Không gian nhân viên gara</h1>
      {session.status === 'loading' && <p role="status">Đang kiểm tra phiên đăng nhập...</p>}
      {session.status === 'login' && <>
        <p>Vui lòng đăng nhập bằng tài khoản có quyền vận hành gara.</p>
        <a href="/#/login">Đăng nhập</a>
      </>}
      {session.status === 'forbidden' && <>
        <p role="alert">Tài khoản của bạn không có quyền truy cập gara.</p>
        <button onClick={clearSession}>Đăng xuất để đổi tài khoản</button>
      </>}
      {session.status === 'error' && <>
        <p role="alert">{session.message}</p>
        <button onClick={retry}>
          Thử lại
        </button>
      </>}
      <p><a href="/">Về trang chủ</a></p>
    </main>
  );
}
