import { fireEvent, render, screen } from '@testing-library/react';
import SiteHeader from './SiteHeader';
import { saveSession } from '../features/auth/session';

afterEach(() => { localStorage.clear(); sessionStorage.clear(); });
test('logged-in renter has a logout action that clears the session', () => {
  saveSession('renter-token', { full_name: 'Nguyễn Thành Long', roles: ['RENTER'] }, true);
  render(<SiteHeader />);
  const logout = screen.getByRole('button', { name: 'Đăng xuất' });
  expect(logout).toBeVisible();
  fireEvent.click(logout);
  expect(localStorage.getItem('xedi_token')).toBeNull();
  expect(sessionStorage.getItem('xedi_token')).toBeNull();
  expect(screen.queryByText(/Nguyễn Thành Long/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  expect(window.location.hash).toBe('#trang-chu');
});
