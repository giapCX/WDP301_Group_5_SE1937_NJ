import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import { postApi } from '../../../services/httpClient';
jest.mock('../../../services/httpClient', () => ({ postApi: jest.fn() }));

beforeEach(() => { postApi.mockReset(); });
test('registration submits email OTP with user details', async () => {
  postApi.mockResolvedValueOnce({ data: { challenge_id: '123456789012345678901234' } }).mockResolvedValueOnce({ data: {} });
  render(<LoginPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));
  fireEvent.change(screen.getByLabelText('Họ và tên (theo CCCD)'), { target: { value: 'Khách Mới' } });
  fireEvent.change(screen.getByLabelText('Số điện thoại liên hệ'), { target: { value: '0987654321' } });
  fireEvent.change(screen.getByLabelText('Địa chỉ Email'), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'NewUser123!' } });
  fireEvent.change(screen.getByLabelText('Xác nhận lại'), { target: { value: 'NewUser123!' } });
  fireEvent.click(screen.getByLabelText(/Tôi đồng ý/));
  fireEvent.click(screen.getByRole('button', { name: 'Gửi mã OTP qua email' }));
  fireEvent.change(await screen.findByLabelText('Mã OTP email'), { target: { value: '654321' } });
  fireEvent.click(screen.getByRole('button', { name: /Tạo tài khoản XeDi/ }));
  await waitFor(() => expect(postApi).toHaveBeenCalledWith('/renter/register', expect.objectContaining({ email: 'new@example.com', challenge_id: '123456789012345678901234', otp: '654321' })));
  expect(await screen.findByText('Đăng ký thành công. Bạn có thể đăng nhập bằng tài khoản vừa tạo.')).toBeInTheDocument();
});
test('forgot password sends email OTP and returns to login after password reset', async () => {
  postApi.mockResolvedValueOnce({ data: { challenge_id: '123456789012345678901234' } })
    .mockResolvedValueOnce({ data: { message: 'Đặt lại mật khẩu thành công.' } });
  render(<LoginPage />);
  fireEvent.click(screen.getByText('Quên mật khẩu?'));
  fireEvent.change(screen.getByLabelText('Email đã đăng ký'), { target: { value: 'customer@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi mã OTP qua email' }));
  const otp = await screen.findByLabelText('Mã OTP email');
  fireEvent.change(otp, { target: { value: '123456' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'Changed123!' } });
  fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: 'Changed123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));
  await waitFor(() => expect(postApi).toHaveBeenCalledWith('/auth/reset-password', { email: 'customer@example.com', password: 'Changed123!', confirm_password: 'Changed123!', challenge_id: '123456789012345678901234', otp: '123456' }));
  expect(await screen.findByText('Đặt lại mật khẩu thành công.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Mật khẩu mới')).not.toBeInTheDocument();
  expect(postApi).toHaveBeenCalledWith('/auth/forgot-password/otp', { email: 'customer@example.com' });
});
