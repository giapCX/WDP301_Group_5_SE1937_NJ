import { useEffect, useState } from 'react';
import { getManagerDashboard } from '../api/managerApi';

export default function useManagerDashboard(period) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    getManagerDashboard(period, { signal: controller.signal })
      .then((result) => { setDashboard(result.data); setError(''); })
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.status === 401 ? 'Vui lòng đăng nhập bằng tài khoản Quản lý để xem dashboard.' : reason.status === 403 ? 'Tài khoản hiện tại chưa có quyền Quản lý.' : reason.message); });
    return () => controller.abort();
  }, [period]);
  return { dashboard, error };
}
