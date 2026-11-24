import { createElement as h, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSession, login } from '../api/authApi.js';
import SignOutButton from '../components/SignOutButton.js';
import RegistrationForm from './RegistrationForm.js';
import { dashboardForRole } from '../dashboardRoutes.js';
import useHomeResource from '../../home/hooks/useHomeResource.js';
import { hotline } from '../../home/homeContent.js';
import Icon from '../../home/components/HomeIcon.js';
import { LoginFooter, LoginHeader, LoginIntro, LoginServices } from './LoginLayout.js';
import '../../home/styles/homepage.css';
import './login.css';

function loginErrorMessage(error) {
  const { status, data } = error.response || {};
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
  }
  if (status >= 400 && status < 500 && typeof data?.message === 'string') {
    return data.message;
  }
  if (!status || status >= 500) {
    return 'Chưa kết nối được với máy chủ VietTour. Vui lòng thử lại sau.';
  }
  return 'Chưa thể đăng nhập. Vui lòng thử lại.';
}

export default function LoginPage() {
  const location = useLocation();
  const session = useHomeResource(getSession);
  const [showPassword, setShowPassword] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(() => new URLSearchParams(location.search).get('mode') === 'register');
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  const { state: loginState } = useLocation();
  const user = signedOut ? null : session.data;

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const account = await login({
        identifier: form.get('identifier'),
        password: form.get('password'),
        remember: form.has('remember'),
      });
      const from = loginState?.role === account.role_name ? loginState.from : null;
      navigate(from || dashboardForRole(account.role_name), { replace: true, state: from?.state });
    } catch (failure) {
      setError(loginErrorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  function changeMode(next, message = '') {
    setError('');
    setNotice(message);
    setRegistering(next);
  }

  return h('div', { className: 'vt-homepage vt-login' },
    h(LoginHeader, { user }),
    h('main', null,
      h('div', { className: 'vt-h-wrap vt-login-card' },
        h(LoginIntro),
        h('section', { className: 'vt-login-form' },
          h('div', { className: 'vt-login-form-top' },
            user ? h('span', null, 'Tài khoản') : h('div', { className: 'vt-auth-switch', role: 'group', 'aria-label': 'Tài khoản VietTour' },
              h('button', { type: 'button', disabled: pending, 'aria-pressed': !registering, onClick: () => changeMode(false) }, 'Đăng nhập'),
              h('button', { type: 'button', disabled: pending, 'aria-pressed': registering, onClick: () => changeMode(true) }, 'Đăng ký mới')),
            h('a', { href: hotline.href }, h(Icon, { name: 'support_agent' }), 'Hỗ trợ tài khoản'),
          ),
          h('h2', null, user?.full_name || (registering ? 'Tạo tài khoản VietTour' : 'Mừng bạn trở lại với VietTour')),
          !user && h('p', null, registering ? 'Đăng ký tài khoản người thuê và xác nhận email.'
            : 'Truy cập lịch trình và quản lý các chuyến đi của bạn.'),
          notice && h('p', { role: 'status', className: 'vt-auth-success' }, notice),
          error && h('p', { role: 'alert', className: 'vt-login-error' }, error),
          user
            ? h(SignOutButton, { redirectTo: null, onSuccess: () => setSignedOut(true) })
            : registering ? h(RegistrationForm, { onComplete: (message) => changeMode(false, message) })
            : h('form', { onSubmit: submit },
              h('label', { htmlFor: 'vt-identifier' }, 'Số điện thoại hoặc email'),
              h('div', { className: 'vt-login-input' }, h(Icon, { name: 'person' }), h('input', {
                id: 'vt-identifier', name: 'identifier', autoComplete: 'username',
                placeholder: 'Nhập số điện thoại hoặc email', required: true, maxLength: 150,
              })),
              h('label', { htmlFor: 'vt-password' }, 'Mật khẩu'),
              h('div', { className: 'vt-login-input vt-login-password' },
                h(Icon, { name: 'lock' }),
                h('input', { id: 'vt-password', name: 'password', type: showPassword ? 'text' : 'password',
                  autoComplete: 'current-password', required: true, maxLength: 256 }),
                h('button', { type: 'button', 'aria-label': showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu',
                  onClick: () => setShowPassword((visible) => !visible) },
                h(Icon, { name: showPassword ? 'visibility_off' : 'visibility' })),
              ),
              h('label', { className: 'vt-login-remember' },
                h('input', { type: 'checkbox', name: 'remember' }), 'Duy trì đăng nhập trên trình duyệt này'),
              h('button', { className: 'vt-h-button', type: 'submit', disabled: pending || session.loading },
                pending ? 'Đang đăng nhập…' : 'Đăng nhập vào VietTour', h(Icon, { name: 'arrow_forward' })),
            ),
        ),
      ),
      h(LoginServices),
    ),
    h(LoginFooter),
  );
}
