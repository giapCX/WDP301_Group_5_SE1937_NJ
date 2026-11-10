import { act, fireEvent, render, screen } from '@testing-library/react';
import useLogin from './useLogin';
import { login } from '../api/authApi';
import { saveSession } from '../session';

jest.mock('../api/authApi', () => ({ login: jest.fn() }));
jest.mock('../session', () => ({ saveSession: jest.fn() }));

function LoginHarness() {
  const { handleLoginSubmit } = useLogin({
    loginData: { account: 'operator@example.com', password: 'secret', rememberMe: false },
    setFormStatus: jest.fn(),
    setStatusType: jest.fn(),
  });
  return (
    <form onSubmit={handleLoginSubmit}>
      <button type="submit">Đăng nhập</button>
    </form>
  );
}

afterEach(() => {
  jest.useRealTimers();
  window.location.hash = '';
  jest.clearAllMocks();
});

test('redirects an operator using the primary role field to the operation workspace', async () => {
  jest.useFakeTimers();
  const user = {
    full_name: 'Operation Staff',
    role: { code: 'OPERATION_STAFF', display_name: 'Nhân viên vận hành' },
  };
  login.mockResolvedValue({ data: { token: 'token', user } });
  render(<LoginHarness />);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  });
  expect(saveSession).toHaveBeenCalledWith('token', user, false);

  act(() => jest.advanceTimersByTime(1000));
  expect(window.location.hash).toBe('#/operation');
});
