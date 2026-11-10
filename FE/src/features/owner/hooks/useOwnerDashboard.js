import { useCallback, useEffect, useState } from 'react';
import { getOwnerDashboard } from '../api/ownerApi';

export default function useOwnerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getOwnerDashboard({ signal: controller.signal })
      .then((result) => setData(result.data))
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.status === 401 ? 'Phiên đăng nhập đã hết hạn.' : reason.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  return { data, error, loading, refresh };
}
