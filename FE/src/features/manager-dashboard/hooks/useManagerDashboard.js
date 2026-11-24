import { useEffect, useMemo, useState } from 'react';
import { fetchManagerDashboard, managerDashboardError } from '../api/managerDashboardApi';

export default function useManagerDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [vehicleStatus, setVehicleStatus] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const normalizedSearch = useMemo(() => search.trim(), [search]);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: '' }));
    fetchManagerDashboard({ year, month, status: vehicleStatus || undefined, search: normalizedSearch || undefined }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ loading: false, data, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState((current) => ({ ...current, loading: false, error: managerDashboardError(error) }));
      });
    return () => controller.abort();
  }, [year, month, vehicleStatus, normalizedSearch, revision]);

  return {
    ...state,
    year,
    month,
    vehicleStatus,
    search,
    setYear,
    setMonth,
    setVehicleStatus,
    setSearch,
    refresh: () => setRevision((value) => value + 1),
  };
}
