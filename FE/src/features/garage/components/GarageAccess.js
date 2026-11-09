import { useEffect, useState } from 'react';
import { canAccessGarage, clearSession, getSessionToken } from '../../auth/session';
import { getApi } from '../../../services/httpClient';

export default function GarageAccess({ children }) {
  const [session, setSession] = useState({ status: 'loading' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = (event) => {
      if (event.type === 'storage' && event.key && !['xedi_token', 'xedi_user'].includes(event.key)) return;
      setSession({ status: 'loading' });
      setRevision((value) => value + 1);
    };
    window.addEventListener('xedi:session', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('xedi:session', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (!getSessionToken()) {
      setSession({ status: 'login' });
      return;
    }
    const controller = new AbortController();
    getApi('/auth/me', { signal: controller.signal })
      .then(({ data: user }) => {
        if (!controller.signal.aborted) {
          setSession({ status: canAccessGarage(user) ? 'ready' : 'forbidden', user });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if ([401, 403, 404].includes(error.status)) {
          clearSession();
          setSession({ status: 'login' });
        } else {
          setSession({ status: 'error', message: error.message });
        }
      });
    return () => controller.abort();
  }, [revision]);

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
        <button onClick={() => { setSession({ status: 'loading' }); setRevision((value) => value + 1); }}>
          Thử lại
        </button>
      </>}
      <p><a href="/">Về trang chủ</a></p>
    </main>
  );
}
