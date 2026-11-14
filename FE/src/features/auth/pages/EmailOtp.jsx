import { useEffect, useRef, useState } from 'react';
import { postApi } from '../../../services/httpClient';

export default function EmailOtp({ email, reset = false, onChange, children }) {
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [remaining, setRemaining] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setChallenge(null); setCode(''); setMessage(''); setBusy(false); onChange({});
    return () => { generation.current += 1; };
  }, [email, reset, onChange]);
  useEffect(() => {
    if (!remaining) return undefined;
    const timer = setTimeout(() => setRemaining(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);
  async function send() {
    const current = generation.current;
    setBusy(true); setMessage('');
    try {
      const result = await postApi(reset ? '/auth/forgot-password/otp' : '/renter/register/otp', { email });
      if (current !== generation.current) return;
      setChallenge(result.data); setCode(''); setRemaining(60);
      onChange({ challenge_id: result.data.challenge_id, otp: '' });
      setMessage('Đã gửi OTP qua email. Hãy kiểm tra cả thư rác. Mã có hiệu lực 5 phút.');
    } catch (error) { if (current === generation.current) setMessage(error.message); }
    finally { if (current === generation.current) setBusy(false); }
  }
  const sendButton = <button className="shrink-0 px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-headline-sm text-body-sm transition-colors disabled:opacity-50" type="button" disabled={busy || remaining > 0 || !email} onClick={send}>{busy ? 'Đang gửi...' : remaining ? `Gửi lại sau ${remaining}s` : 'Gửi mã OTP qua email'}</button>;
  return <div className={children ? '' : 'renter-otp'}>
    {children ? <div className="flex items-center gap-2 pr-1.5 rounded-xl border border-outline-variant/60 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 bg-surface-container-lowest">{children}{sendButton}</div> : sendButton}
    {message && <p role="status">{message}</p>}
    {challenge && <label className="renter-field">Mã OTP email<input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => { setCode(event.target.value); onChange({ challenge_id: challenge.challenge_id, otp: event.target.value }); }} /></label>}
  </div>;
}
