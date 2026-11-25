import { useCallback, useEffect, useState } from 'react';
import { fetchBookings, getBookingError } from '../api/bookingApi';
import { BOOKING_TABS } from '../../../shared/booking/bookingConstants';

export default function useBookings(initialStatus = 'pending') {
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ items: [], total: 0, total_pages: 0 });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetchBookings({ status: status || undefined, page, limit: 8 }, controller.signal)
      .then(setResult)
      .catch((failure) => {
        if (!controller.signal.aborted) setError(getBookingError(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, page, revision]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      BOOKING_TABS.map(async (tab) => {
        const data = await fetchBookings(
          { status: tab.key || undefined, limit: 1 },
          controller.signal,
        );
        return [tab.key, data.total];
      }),
    )
      .then((entries) => setCounts(Object.fromEntries(entries)))
      .catch(() => {
        if (!controller.signal.aborted) setCounts({});
      });
    return () => controller.abort();
  }, [revision]);

  const changeStatus = useCallback((value) => {
    setPage(1);
    setStatus(value);
  }, []);

  return {
    ...result,
    status,
    page,
    counts,
    loading,
    error,
    setPage,
    changeStatus,
    refresh: () => setRevision((value) => value + 1),
  };
}
