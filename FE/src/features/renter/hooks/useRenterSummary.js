import { useEffect, useState } from 'react';
import { getRenter } from '../api/renterApi';

export default function useRenterSummary(enabled) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    Promise.all([
      getRenter('/profile', { signal: controller.signal }),
      getRenter('/bookings?status=active', { signal: controller.signal }),
      getRenter('/bookings?status=awaiting_payment', { signal: controller.signal }),
    ]).then(([profile, active, pending]) => setSummary({ profile: profile.data, active, pending }))
      .catch(reason => {
        if (reason.name !== 'AbortError') setError(reason.message);
      });
    return () => controller.abort();
  }, [enabled]);

  return { summary, error };
}
