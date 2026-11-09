import { useEffect, useRef, useState } from 'react';
import { login } from '../api/authApi';
import { getLoginDestination, saveSession } from '../session';

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
        const destination = getLoginDestination(user);
        if (destination === '/garage' || destination === '/owner') window.location.assign(destination);
        else window.location.hash = destination.slice(1);
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
