import { useEffect, useState } from 'react';
import { getOwnerAgreement } from '../api/ownerApi';

export default function useOwnerAgreement(agreementId) {
  const [agreement, setAgreement] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agreementId) {
      setAgreement(null);
      setError('');
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getOwnerAgreement(agreementId, { signal: controller.signal })
      .then((result) => setAgreement(result.data))
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.message || 'Không tải được hợp đồng.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [agreementId]);

  return { agreement, error, loading };
}
