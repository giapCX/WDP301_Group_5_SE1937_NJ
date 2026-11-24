import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/authApi.js';

const DEFAULT_ERROR = 'Chưa thể đăng xuất. Vui lòng thử lại.';

export default function useSignOut({ onSuccess, redirectTo = '/login' } = {}) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError('');

    try {
      await logout();
      if (onSuccess) onSuccess();
      if (redirectTo) navigate(redirectTo, { replace: true });
    } catch {
      setError(DEFAULT_ERROR);
    } finally {
      setSigningOut(false);
    }
  }

  return { signingOut, error, signOut };
}
