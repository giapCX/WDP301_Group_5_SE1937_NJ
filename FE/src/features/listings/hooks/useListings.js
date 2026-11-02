import { useEffect, useState } from 'react';
import { getListings } from '../api/listingApi';

export default function useListings({ filters, sort, search, limit }) {
  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ limit, sort, ...filters });
    if (search) {
      if (search.city) query.set('city', search.city);
      query.set('startAt', search.startAt);
      query.set('endAt', search.endAt);
    }
    getListings(query, { signal: controller.signal })
      .then((result) => {
        setListings(result.data);
        setTotal(result.pagination.total);
      })
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, sort, search, limit, retry]);


  return { listings, total, loading, error, setRetry };
}
