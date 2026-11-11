import { useEffect, useState } from 'react';
import { getRenter } from '../api/renterApi';
import { getSessionToken } from '../../auth/session';

export default function useRenterWorkspace({ page, filter, search, retry }) {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState(0);
  const token = getSessionToken();

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      getRenter('/config', { signal: controller.signal }),
      getRenter('/bookings?' + new URLSearchParams({ page, status: filter, q: search }), { signal: controller.signal }),
      getRenter('/incidents', { signal: controller.signal }),
    ]).then(([configResponse, bookingsResponse, incidentsResponse]) => {
      setConfig(configResponse.data);
      setBookings(bookingsResponse.data);
      setPagination(bookingsResponse.pagination);
      setIncidents(incidentsResponse.data);
    }).catch(reason => {
      if (reason.name !== 'AbortError') setError(reason.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [page, retry, poll, token, filter, search]);

  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') setPoll(value => value + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, [token]);

  return { token, config, error, bookings, incidents, pagination, loading };
}
