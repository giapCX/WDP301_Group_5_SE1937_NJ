import { useEffect, useState } from 'react';
import { fetchMonitoredTrips } from '../api/tripMonitoringApi';
export default function useTripMonitoring() {
  const [status, setStatus] = useState('in_progress');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetchMonitoredTrips({ status, page, limit: 10 }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (page > Math.max(1, result.total_pages))
          setPage(Math.max(1, result.total_pages));
        else {
          setData(result);
          setUpdatedAt(new Date());
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure.response?.data?.message || 'Không tải được dữ liệu theo dõi chuyến.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, page, revision]);
  return {
    status,
    page,
    data,
    loading,
    error,
    updatedAt,
    setPage,
    filter: (value) => {
      setStatus(value);
      setPage(1);
    },
    refresh: () => setRevision((value) => value + 1),
  };
}
