import { useEffect, useState } from 'react';
import { loadOperations, operationError } from '../api/operationsApi';
export default function useOperations(path, params = {}) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!path) { setData(null); setLoading(false); return; }
    const controller = new AbortController();
    setData(null); setLoading(true); setError('');
    loadOperations(path, JSON.parse(key), controller.signal).then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((failure) => { if (!controller.signal.aborted) setError(operationError(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, key, revision]);
  return { data, error, loading, refresh: () => setRevision((value) => value + 1) };
}
