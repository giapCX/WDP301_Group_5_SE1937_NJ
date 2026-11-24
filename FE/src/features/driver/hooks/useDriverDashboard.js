import { useEffect, useState } from 'react';
import { driverError, fetchDriverDashboard } from '../api/driverApi';

export default function useDriverDashboard() {
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetchDriverDashboard({ status, page, limit: 10 }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (page > Math.max(1, result.trips.total_pages))
          setPage(Math.max(1, result.trips.total_pages));
        else setData(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(driverError(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, page, revision]);
  return {
    data,
    loading,
    error,
    page,
    status,
    setPage,
    filter: (value) => {
      setStatus(value);
      setPage(1);
    },
    refresh: () => setRevision((value) => value + 1),
  };
}
