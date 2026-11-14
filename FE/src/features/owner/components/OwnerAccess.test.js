import { fireEvent, render, screen } from '@testing-library/react';
import OwnerAccess from './OwnerAccess';
import { saveSession } from '../../auth/session';

const owner = { _id: 'owner-user', full_name: 'Chủ xe', roles: ['OWNER'] };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

test('direct owner URL requires login and does not render the owner workspace', async () => {
  render(<OwnerAccess><div>Owner workspace</div></OwnerAccess>);

  expect(await screen.findByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/#/login');
  expect(screen.queryByText('Owner workspace')).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('validates the session user before rendering the owner workspace', async () => {
  saveSession('owner-jwt', owner, true);
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: owner }) });

  render(<OwnerAccess><div>Owner workspace</div></OwnerAccess>);

  expect(await screen.findByText('Owner workspace')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer owner-jwt' }),
  }));
});

test('does not render the owner workspace for an account without owner access', async () => {
  saveSession('renter-jwt', { roles: ['RENTER'] }, true);
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { roles: ['RENTER'] } }) });

  render(<OwnerAccess><div>Owner workspace</div></OwnerAccess>);

  expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền truy cập cổng chủ xe');
  expect(screen.queryByText('Owner workspace')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất để đổi tài khoản' }));
  expect(localStorage.getItem('xedi_token')).toBeNull();
});

test('clears an expired session and requires login again', async () => {
  saveSession('expired-jwt', owner, true);
  global.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'Expired' } }) });

  render(<OwnerAccess><div>Owner workspace</div></OwnerAccess>);

  expect(await screen.findByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
  expect(localStorage.getItem('xedi_token')).toBeNull();
});
