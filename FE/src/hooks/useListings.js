import { useEffect, useState } from 'react';
import { fetchListings } from '../services/listings';

export default function useListings(query) {
  const [result, setResult] = useState({
    query: null,
    cars: [],
    pagination: { total: 0, totalPages: 0, page: 1, limit: 6 },
    error: '',
    loading: true,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setResult((previous) => ({ ...previous, query, loading: true, error: '' }));
    // Debounce typing/slider changes and cancel stale responses.
    const timer = setTimeout(async () => {
      try {
        const data = await fetchListings(query, controller.signal);
        if (active) setResult({ ...data, query, loading: false, error: '' });
      } catch (error) {
        if (active)
          setResult({
            query,
            cars: [],
            pagination: { total: 0, totalPages: 0, page: 1, limit: 6 },
            loading: false,
            error: error.message || 'Không thể kết nối đến máy chủ.',
          });
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, attempt]);
  return {
    ...result,
    loading: result.loading || result.query !== query,
    retry: () => setAttempt((value) => value + 1),
  };
}
