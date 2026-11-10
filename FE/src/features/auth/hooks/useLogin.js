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
        const roles = user.roles || [];
        window.location.hash = roles.includes('ADMIN')
          ? '#/admin'
          : roles.includes('MANAGER')
            ? '#/manager'
            : '#trang-chu';
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
