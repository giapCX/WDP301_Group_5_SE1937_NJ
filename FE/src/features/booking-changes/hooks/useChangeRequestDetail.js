import { useEffect, useState } from 'react';
import {
  approveChangeRequest,
  changeRequestError,
  fetchChangeRequest,
  rejectChangeRequest,
} from '../api/changeRequestApi';

export default function useChangeRequestDetail(id, revision, onUpdated) {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setStale(false);
    setRequest(null);
    fetchChangeRequest(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setRequest(data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(changeRequestError(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, revision, retry]);

  async function decide(action, reason) {
    if (saving || stale) return;
    setSaving(true);
    setError('');
    try {
      const updated =
        action === 'approve'
          ? await approveChangeRequest(id)
          : await rejectChangeRequest(id, reason.trim());
      setRequest((previous) => ({ ...previous, ...updated }));
      onUpdated(action);
    } catch (failure) {
      setError(changeRequestError(failure));
      if (failure.response?.status === 409) setStale(true);
    } finally {
      setSaving(false);
    }
  }

  return {
    request,
    loading,
    saving,
    error,
    stale,
    decide,
    reload: () => setRetry((value) => value + 1),
  };
}
