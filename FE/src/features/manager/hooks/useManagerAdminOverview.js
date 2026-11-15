import { useCallback, useEffect, useState } from 'react';
import { getManagerResource } from '../api/managerApi';

export default function useManagerAdminOverview() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getManagerResource('adminOverview', { signal: controller.signal })
      .then((result) => setSnapshot(result.data))
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message || 'Không thể tải tổng quan quản trị.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  return { snapshot, loading, error, refresh };
}
