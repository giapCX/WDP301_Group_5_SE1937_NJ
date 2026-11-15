import { useState, useEffect } from 'react';
import { getRenter, putRenter } from '../api/renterApi';
import { Field, Upload, Otp, PrivateImage } from './Controls';
export default function Profile() {
  const [profile, setProfile] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState({}),
    [password, setPassword] = useState({});
  const load = () => getRenter('/profile').then(r => {
    return setProfile({
      ...r.data,
      city: r.data.contact_profile?.city || '',
      address: r.data.contact_profile?.address || '',
      avatar_key: r.data.contact_profile?.avatar_key || ''
    });
  });
  useEffect(() => {
    let active = true;
    getRenter('/profile').then(r => {
      if (active) {
            setProfile({
          ...r.data,
          city: r.data.contact_profile?.city || '',
          address: r.data.contact_profile?.address || '',
          avatar_key: r.data.contact_profile?.avatar_key || ''
        });
      }
    }).catch(e => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, []);
  async function perform(work) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!profile) return <p role={error ? 'alert' : 'status'}>{error || 'Đang tải hồ sơ...'}</p>;
  const change = e => setProfile({
    ...profile,
    [e.target.name]: e.target.value
  });
  return <div className="renter-stack">{error && <p role="alert" className="renter-error">{error}</p>}{notice && <p role="status" className="renter-notice">{notice}</p>}
    <section className="renter-card"><h2>Hồ sơ cá nhân</h2><PrivateImage fileId={profile.avatar_key} alt="Ảnh đại diện" />
      <form onSubmit={e => {
        e.preventDefault();
        perform(async () => {
          await putRenter('/profile', {
            ...profile,
            ...otp
          });
          await load();
          setNotice('Đã lưu hồ sơ.');
        });
      }}>
        <div className="renter-grid">{[['full_name', 'Họ và tên'], ['email', 'Email'], ['phone', 'Số điện thoại'], ['city', 'Thành phố'], ['address', 'Địa chỉ liên hệ']].map(([name, label]) => <Field key={name} label={label} name={name} value={profile[name] || ''} required={['full_name', 'email', 'phone'].includes(name)} onChange={change} />)}</div>
        <Upload label="Ảnh đại diện · tối đa 5 MB" purpose="avatar" onChange={avatar_key => setProfile({
          ...profile,
          avatar_key
        })} />
        <p>Đổi email hoặc số điện thoại cần xác thực OTP.</p><Otp target={{purpose:'profile',email:profile.email,phone:profile.phone}} onChange={setOtp} />
        <button disabled={busy}>Lưu hồ sơ</button>
        {sessionStorage.getItem('renterBookingReturn') && <a href={sessionStorage.getItem('renterBookingReturn')} onClick={() => sessionStorage.removeItem('renterBookingReturn')}>Quay lại đặt xe</a>}
      </form>
    </section>
    <section className="renter-card"><h2>Đổi mật khẩu</h2><form onSubmit={e => {
        e.preventDefault();
        perform(async () => {
          await putRenter('/password', password);
          setPassword({});
          setNotice('Đã đổi mật khẩu.');
        });
      }}><div className="renter-grid">{[['current_password', 'Mật khẩu hiện tại'], ['new_password', 'Mật khẩu mới'], ['confirm_password', 'Xác nhận mật khẩu mới']].map(([name, label]) => <Field key={name} label={label} type="password" required value={password[name] || ''} autoComplete={name === 'current_password' ? 'current-password' : 'new-password'} onChange={e => setPassword({
            ...password,
            [name]: e.target.value
          })} />)}</div><p>Mật khẩu mới 8–32 ký tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</p><button disabled={busy}>Đổi mật khẩu</button></form></section>
  </div>;
}
