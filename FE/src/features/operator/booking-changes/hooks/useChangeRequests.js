import { useEffect, useState } from 'react';
import { changeRequestError, fetchChangeRequests } from '../api/changeRequestApi';

export default function useChangeRequests() {
  const [status, setStatus] = useState('');
  const [bookingFilter, setBookingFilter] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ items: [], total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetchChangeRequests(
      {
        status: status || undefined,
        booking_id: bookingFilter || undefined,
        page,
        limit: 10,
      },
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, data.total_pages);
        if (page > lastPage) setPage(lastPage);
        else setResult(data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(changeRequestError(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, bookingFilter, page, revision]);

  return {
    ...result,
    status,
    page,
    bookingFilter,
    loading,
    error,
    revision,
    setPage,
    filterStatus: (value) => {
      setStatus(value);
      setPage(1);
    },
    filterBooking: (value) => {
      setBookingFilter(value);
      setPage(1);
    },
    refresh: () => setRevision((value) => value + 1),
  };
}
