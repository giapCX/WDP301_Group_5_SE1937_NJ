import { createElement as h, useEffect, useState } from 'react';
import { registerWithOtp, requestRegistrationOtp } from '../api/authApi.js';

export default function RegistrationForm({ onComplete }) {
  const [profile, setProfile] = useState(null);
  const [challengeId, setChallengeId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!retryAt) return undefined;
    const tick = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  async function sendOtp(nextProfile) {
    setPending(true);
    setError('');
    try {
      const id = await requestRegistrationOtp(nextProfile);
      setProfile(nextProfile);
      setChallengeId(id);
      setRemaining(60);
      setRetryAt(Date.now() + 60000);
    } catch (failure) {
      setError(failure.response?.data?.message || 'Chưa gửi được mã xác nhận. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!challengeId) {
      const { confirmPassword, ...nextProfile } = Object.fromEntries(form);
      if (nextProfile.password !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp.');
        return;
      }
      await sendOtp(nextProfile);
      return;
    }
    setPending(true);
    setError('');
    try {
      const message = await registerWithOtp({ email: profile.email, challengeId, code: form.get('code').trim() });
      onComplete(message);
    } catch (failure) {
      setError(failure.response?.data?.message || 'Chưa thể tạo tài khoản. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return h('form', { key: challengeId || 'profile', onSubmit: submit },
    error && h('p', { role: 'alert', className: 'vt-login-error' }, error),
    challengeId
      ? h('div', { className: 'vt-register-fields' },
        h('p', { role: 'status' }, 'Mã xác nhận đã được gửi đến ', h('strong', null, profile.email), '.'),
        h('label', { htmlFor: 'vt-register-code' }, 'Mã xác nhận email'),
        h('input', { id: 'vt-register-code', name: 'code', className: 'form-control', autoComplete: 'one-time-code',
          inputMode: 'numeric', pattern: '[0-9]{6}', maxLength: 6, placeholder: 'Nhập 6 chữ số', required: true }),
      )
      : h('div', { className: 'vt-register-fields' },
        h('label', { htmlFor: 'vt-register-name' }, 'Họ và tên người liên hệ (*)'),
        h('input', { id: 'vt-register-name', name: 'fullName', className: 'form-control',
          autoComplete: 'name', maxLength: 120, defaultValue: profile?.fullName,
          placeholder: 'Nhập họ tên người trực tiếp đặt và làm việc với tài xế', required: true }),
        h('label', { htmlFor: 'vt-register-phone' }, 'Số điện thoại (*)'),
        h('input', { id: 'vt-register-phone', name: 'phone', type: 'tel', className: 'form-control',
          autoComplete: 'tel', maxLength: 25, defaultValue: profile?.phone,
          placeholder: 'Nhập SĐT dùng Zalo/gọi điện để tài xế liên hệ đón khách', required: true }),
        h('label', { htmlFor: 'vt-register-email' }, 'Email (*)'),
        h('input', { id: 'vt-register-email', name: 'email', type: 'email', className: 'form-control',
          autoComplete: 'email', maxLength: 150, defaultValue: profile?.email,
          placeholder: 'Nhập email để nhận xác nhận lịch trình, báo giá và hóa đơn điện tử', required: true }),
        h('label', { htmlFor: 'vt-register-password' }, 'Mật khẩu (*)'),
        h('input', { id: 'vt-register-password', name: 'password', type: 'password',
          className: 'form-control', autoComplete: 'new-password', minLength: 8, maxLength: 256,
          placeholder: 'Tối thiểu 8 ký tự', required: true }),
        h('label', { htmlFor: 'vt-register-confirm' }, 'Xác nhận mật khẩu (*)'),
        h('input', { id: 'vt-register-confirm', name: 'confirmPassword', type: 'password',
          className: 'form-control', autoComplete: 'new-password', minLength: 8, maxLength: 256,
          placeholder: 'Nhập lại mật khẩu', required: true }),
      ),
    h('button', { type: 'submit', className: 'vt-h-button', disabled: pending },
      pending ? 'Đang xử lý…' : challengeId ? 'Xác nhận và tạo tài khoản' : 'Gửi mã xác nhận'),
    challengeId && h('div', { className: 'vt-register-actions' },
      h('button', { type: 'button', className: 'btn btn-link', disabled: pending || remaining > 0, onClick: () => sendOtp(profile) },
        remaining ? 'Gửi lại sau ' + remaining + ' giây' : 'Gửi lại mã'),
      h('button', { type: 'button', className: 'btn btn-link', disabled: pending, onClick: () => {
        setChallengeId('');
        setError('');
        setRetryAt(0);
        setRemaining(0);
      } }, 'Đổi email'),
    ),
  );
}
