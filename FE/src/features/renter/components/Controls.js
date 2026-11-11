import { useState, useEffect } from 'react';
import { postRenter, uploadRenterFile, renterFile } from '../api/renterApi';
export function Field({
  label,
  children,
  ...props
}) {
  return <label className="renter-field"><span>{label}</span>{children || <input {...props} />}</label>;
}
export function Upload({
  label,
  purpose,
  multiple = false,
  onChange
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [names, setNames] = useState([]);
  return <div className="renter-field"><span>{label}</span><input type="file" multiple={multiple} disabled={busy} accept={purpose === 'incident' ? 'image/jpeg,image/png,video/mp4' : purpose === 'avatar' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png'} onChange={async e => {
      const selected = Array.from(e.target.files || []);
      if (multiple && selected.length > 10) {
        setError('Tối đa 10 tệp.');
        return;
      }
      setBusy(true);
      setError('');
      try {
        const docs = [];
        for (const file of selected) docs.push(await uploadRenterFile(file, purpose));
        setNames(docs.map(d => d.name));
        onChange(multiple ? docs.map(d => d._id) : docs[0]?._id);
      } catch (reason) {
        setError(reason.message);
      } finally {
        setBusy(false);
      }
    }} /><small>{busy ? 'Đang tải tệp...' : names.join(', ')}</small>{error && <p role="alert">{error}</p>}</div>;
}
export function Otp({
  target,
  onChange,
  registration = false
}) {
  const [challenge, setChallenge] = useState(null),
    [otp, setOtp] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const key = JSON.stringify(target);
  useEffect(() => {
    setChallenge(null);
    setOtp('');
    onChange({});
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="renter-otp"><button type="button" disabled={busy} onClick={async () => {
      setBusy(true);
      setError('');
      try {
        const result = await postRenter(registration ? '/register/otp' : '/otp', target);
        setChallenge(result.data);
        onChange({
          challenge_id: result.data.challenge_id,
          otp
        });
      } catch (reason) {
        setError(reason.message);
      } finally {
        setBusy(false);
      }
    }}>Gửi mã OTP</button>{challenge && <><p>Hạn dùng: {new Date(challenge.expires_at).toLocaleTimeString('vi-VN')}</p>{challenge.demo && <p className="renter-notice">Mô phỏng OTP: <strong>{challenge.demo_code}</strong>. Chưa gửi SMS/email thật.</p>}<Field label="Mã OTP" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e => {
        setOtp(e.target.value);
        onChange({
          challenge_id: challenge.challenge_id,
          otp: e.target.value
        });
      }} /></>}{error && <p role="alert">{error}</p>}</div>;
}
export function PrivateImage({
  fileId,
  alt
}) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true,
      url;
    if (fileId && /^[a-f0-9]{24}$/i.test(fileId)) renterFile(fileId).then(blob => {
      if (active) {
        url = URL.createObjectURL(blob);
        setSrc(url);
      }
    }).catch(() => {});
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);
  return src ? <img className="renter-avatar" src={src} alt={alt} /> : null;
}
