import { useState, useEffect } from 'react';
import { getRenter, putRenter, postRenter, statusName } from '../api/renterApi';
import { Field, Upload, Otp, PrivateImage } from './Controls';
export default function Profile({
  config
}) {
  const [profile, setProfile] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState({}),
    [password, setPassword] = useState({}),
    [kyc, setKyc] = useState({
      document_type: 'Citizen_ID',
      license_class: 'B2'
    });
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
  const kchange = e => setKyc({
    ...kyc,
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
      </form>
    </section>
    <section className="renter-card"><h2>CCCD và giấy phép lái xe</h2><p>Danh tính: {statusName(profile.identity_kyc?.status)} · GPLX: {statusName(profile.driver_license?.verification_status)}</p>
      {config?.services.ekyc === 'demo' && <p className="renter-notice">Đang dùng xác minh mô phỏng; chỉ gửi giấy tờ thử nghiệm.</p>}
      {config?.services.ekyc === 'unconfigured' && <p>Hồ sơ sẽ được lưu ở trạng thái chờ xác minh; chưa có nhà cung cấp eKYC.</p>}
      <form onSubmit={e => {
        e.preventDefault();
        perform(async () => {
          const r = await postRenter('/kyc', kyc);
          await load();
          setNotice(r.data.message);
        });
      }}>
        <div className="renter-grid"><Field label="Loại giấy tờ"><select name="document_type" value={kyc.document_type} onChange={kchange}><option>Citizen_ID</option><option>Passport</option></select></Field><Field label="Số CCCD / Passport" required name="document_number" onChange={kchange} /><Field label="Số GPLX (12 số)" required name="license_number" onChange={kchange} /><Field label="Hạng GPLX"><select name="license_class" value={kyc.license_class} onChange={kchange}>{['B1', 'B2', 'C', 'D', 'E'].map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Ngày hết hạn GPLX" required type="date" name="expires_at" onChange={kchange} /></div>
        <p>Ảnh JPEG/PNG rõ nét, 100 KB–10 MB mỗi ảnh.</p><div className="renter-grid">{[['id_front', 'Mặt trước CCCD / Passport'], ...(kyc.document_type === 'Citizen_ID' ? [['id_back', 'Mặt sau CCCD']] : []), ['license_front', 'Mặt trước GPLX'], ['license_back', 'Mặt sau GPLX']].map(([key, label]) => <Upload key={key} label={label} purpose="identity" onChange={value => setKyc(prev => ({
            ...prev,
            [key]: value
          }))} />)}</div>
        <button disabled={busy || profile.identity_kyc?.status === 'verified'}>Gửi hồ sơ xác minh</button>
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
