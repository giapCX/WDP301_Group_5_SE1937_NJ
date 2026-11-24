import { useCallback, useEffect, useRef, useState } from 'react';
import { loadBookings } from '../api/reservationsApi.js';
import { errorMessage } from '../reservationFormat.js';

const emptyList = { items: [], nextBefore: null, checkoutAvailable: false };

export default function useRenterBookings() {
  const [list, setList] = useState(emptyList);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(null);

  const fetchPage = useCallback(async (before) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await loadBookings(before, controller.signal);
      if (controller.signal.aborted) return;
      setList((previous) => before ? { ...data, items: [...previous.items, ...data.items] } : data);
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(errorMessage(failure, before ? 'Chưa thể tải thêm đơn.' : 'Chưa thể tải danh sách đơn.'));
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(null);
    return () => request.current?.abort();
  }, [fetchPage, revision]);

  const refresh = () => setRevision((value) => value + 1);
  const loadMore = () => {
    if (list.nextBefore && !loading) fetchPage(list.nextBefore);
  };

  return { ...list, revision, loading, error, refresh, loadMore };
}

