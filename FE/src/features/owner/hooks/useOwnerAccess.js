import { useCallback, useEffect, useState } from 'react';
import { getCurrentSessionUser } from '../../auth/api/authApi';
import { canAccessOwner, clearSession, getSessionToken } from '../../auth/session';

export default function useOwnerAccess() {
  const [session, setSession] = useState({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const refresh = (event) => {
      if (event.type === 'storage' && event.key && !['xedi_token', 'xedi_user'].includes(event.key)) return;
      setSession({ status: 'loading' });
      retry();
    };
    window.addEventListener('xedi:session', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('xedi:session', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [retry]);

  useEffect(() => {
    if (!getSessionToken()) {
      setSession({ status: 'login' });
      return undefined;
    }

    const controller = new AbortController();
    getCurrentSessionUser({ signal: controller.signal })
      .then(({ data: user }) => {
        if (!controller.signal.aborted) {
          setSession({ status: canAccessOwner(user) ? 'ready' : 'forbidden', user });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if ([401, 403, 404].includes(error.status)) {
          clearSession();
          setSession({ status: 'login' });
        } else {
          setSession({ status: 'error', message: error.message });
        }
      });
    return () => controller.abort();
  }, [revision]);

  return { session, retry };
}
