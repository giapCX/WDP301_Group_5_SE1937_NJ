import { useState } from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import useLogin from './useLogin';

function LoginHarness() {
  const [message, setFormStatus] = useState('');
  const [, setStatusType] = useState('');
  const { handleLoginSubmit } = useLogin({
    loginData: { account: 'renter@example.com', password: 'password', rememberMe: false },
    setFormStatus, setStatusType,
  });
  return <form onSubmit={handleLoginSubmit}><button>Đăng nhập</button><p>{message}</p></form>;
}

test('successful renter login redirects to the renter homepage', async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/#/login');
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: {
    token: 'renter-token', user: { full_name: 'Khách Thuê', roles: ['RENTER'], permissions: ['booking.create'] },
  } }) }));
  try {
    render(<LoginHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(sessionStorage.getItem('xedi_token')).toBe('renter-token'));
    await waitFor(() => expect(window.location.hash).toBe('#/renter'), { timeout: 2500 });
  } finally {
    delete global.fetch;
    sessionStorage.clear();
  }
});
