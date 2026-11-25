import { useEffect, useState } from 'react';
import { fetchManagerDashboard, managerDashboardError } from '../api/managerDashboardApi';

export default function useManagerDashboard(enabled = true) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false, data: null, error: '' });
      return undefined;
    }
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: '' }));
    fetchManagerDashboard({ year, month }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ loading: false, data, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState((current) => ({ ...current, loading: false, error: managerDashboardError(error) }));
      });
    return () => controller.abort();
  }, [enabled, year, month, revision]);

  return {
    ...state,
    year,
    month,
    setYear,
    setMonth,
    refresh: () => setRevision((value) => value + 1),
  };
}
