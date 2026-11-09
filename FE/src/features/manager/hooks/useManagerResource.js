import { useEffect, useState } from 'react';
import { getManagerResource } from '../api/managerApi';

export default function useManagerResource(active) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const supportsDateRange = ['finance', 'inspections'].includes(active);
    const request = ['vehicles', 'incidents', 'policies', 'staff', 'finance', 'inspections'].includes(active)
      ? getManagerResource(active, { ...(supportsDateRange ? { from, to } : {}), signal: controller.signal })
      : Promise.resolve({ data: [] });
    request.then((result) => setData(result.data))
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active, reload, from, to]);
  return { data, loading, error, from, to, setFrom, setTo, refresh: () => setReload((value) => value + 1) };
}
