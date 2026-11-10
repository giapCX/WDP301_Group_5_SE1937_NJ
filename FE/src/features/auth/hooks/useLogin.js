import { useEffect, useRef, useState } from 'react';
import { login } from '../api/authApi';
import { saveSession } from '../session';

export default function useLogin({ loginData, setFormStatus, setStatusType }) {
  const [isLoading, setIsLoading] = useState(false);
  const redirectTimer = useRef();
  useEffect(() => () => clearTimeout(redirectTimer.current), []);
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setFormStatus('');
    setIsLoading(true);
    setStatusType('info');

    try {
      const response = await login({
        account: loginData.account,
        password: loginData.password,
      });

      const user = response.data?.user;
      const token = response.data?.token;

      saveSession(token, user, loginData.rememberMe);

      setStatusType('success');
      setFormStatus(
        `Đăng nhập thành công! Chào mừng ${user.full_name || user.email} (${user.role?.display_name || user.role?.code || 'Thành viên'}). Đang chuyển hướng...`
      );

      redirectTimer.current = setTimeout(() => {
        const roles = new Set([
          ...(Array.isArray(user.roles) ? user.roles : []),
          user.role?.code,
        ].filter(Boolean));
        if (roles.has('MANAGER') || roles.has('ADMIN')) {
          window.location.hash = '#/manager';
        } else if (roles.has('OPERATION_STAFF')) {
          window.location.hash = '#/operation';
        } else {
          window.location.hash = '#trang-chu';
        }
      }, 1000);
    } catch (err) {
      setStatusType('error');
      setFormStatus(err.message || 'Email/Số điện thoại hoặc mật khẩu không chính xác.');
    } finally {
      setIsLoading(false);
    }
  };


  return { isLoading, handleLoginSubmit };
}
