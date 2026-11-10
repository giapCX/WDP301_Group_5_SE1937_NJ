import { useCallback, useEffect, useMemo, useState } from 'react';
import { getManagerResource } from '../api/managerApi';

export default function useManagerCollection(resource, query = {}) {
  const queryKey = useMemo(() => JSON.stringify(query), [query]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getManagerResource(resource, { ...JSON.parse(queryKey), signal: controller.signal })
      .then((result) => setData(result.data || []))
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.message || 'Không thể tải dữ liệu.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resource, queryKey, reload]);

  return { data, loading, error, refresh };
}
