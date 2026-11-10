import { useCallback, useEffect, useMemo, useState } from 'react';
import { getManagerResource } from '../api/managerApi';

export default function useManagerCollection(resource, query = {}, { paginate = true } = {}) {
  const queryKey = useMemo(() => JSON.stringify(query), [query]);
  const key = `${resource}:${queryKey}`;
  const [selection, setSelection] = useState({ key, page: 1, pageSize: 10 });
  const page = selection.key === key ? selection.page : 1;
  const pageSize = selection.pageSize;
  const paginated = paginate && resource !== 'operations';
  const [pagination, setPagination] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getManagerResource(resource, { ...JSON.parse(queryKey), ...(paginated ? { page, limit: pageSize } : {}), signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result.data || []);
        setPagination(result.pagination || null);
        if (paginated && result.pagination) setSelection({ key, page: result.pagination.page, pageSize });
      })
      .catch((reason) => {
        if (!controller.signal.aborted && reason.name !== 'AbortError') setError(reason.message || 'Không thể tải dữ liệu.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resource, queryKey, key, reload, page, pageSize, paginated]);

  return { data, loading, error, refresh, paging: paginated ? {
    page, pageSize, total: pagination?.total ?? 0, disabled: loading,
    onPageChange: (value) => setSelection({ key, page: value, pageSize }),
    onPageSizeChange: (value) => setSelection({ key, page: 1, pageSize: value }),
  } : undefined };
}
