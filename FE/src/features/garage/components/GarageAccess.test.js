import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../../../app/App';
import { clearSession, saveSession } from '../../auth/session';

jest.mock('../api/garageApi', () => ({
  ...jest.requireActual('../api/garageApi'),
  getGarageWorkspace: jest.fn(async () => ({ data: { tasks: [], incidents: [], history: [], vehicles: [], permissions: [] } })),
}));

const staff = {
  _id: 'garage-user', full_name: 'Nhân viên thật',
  roles: ['GARAGE_STAFF'], permissions: ['vehicle.intake'],
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/garage');
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
  window.history.replaceState(null, '', '/');
});

test('direct garage URL requires login and does not mount the demo workspace', async () => {
  render(<App />);
  expect(await screen.findByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/#/login');
  expect(screen.queryByRole('navigation', { name: 'Garage Staff' })).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('validates the stored JWT, shows the server user, and closes the workspace on logout', async () => {
  saveSession('login-jwt', { full_name: 'Old local name' }, false);
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: staff }) });
  render(<App />);
  expect(await screen.findByText(staff.full_name)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer login-jwt' }),
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất', exact: true }));
  expect(await screen.findByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
  expect(sessionStorage.getItem('xedi_token')).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Garage Staff' })).not.toBeInTheDocument();
});

test('does not trust garage permissions saved in the browser', async () => {
  saveSession('renter-jwt', staff, true);
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({
    data: { full_name: 'Renter', permissions: ['booking.create'] },
  }) });
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền truy cập gara');
  expect(screen.queryByRole('navigation', { name: 'Garage Staff' })).not.toBeInTheDocument();
});

test('expired session is cleared and requires login again', async () => {
  saveSession('expired-jwt', staff, true);
  global.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { message: 'Expired' } }) });
  render(<App />);
  expect(await screen.findByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
  expect(localStorage.getItem('xedi_token')).toBeNull();
});

test('network failure offers retry without discarding the session', async () => {
  saveSession('login-jwt', staff, true);
  global.fetch.mockRejectedValueOnce(new Error('Mất kết nối'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: staff }) });
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối');
  expect(localStorage.getItem('xedi_token')).toBe('login-jwt');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText(staff.full_name)).toBeInTheDocument();
});

test('late authentication response cannot reopen the workspace after logout', async () => {
  saveSession('login-jwt', staff, true);
  let resolveResponse;
  global.fetch.mockImplementation(() => new Promise((resolve) => { resolveResponse = resolve; }));
  render(<App />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  act(() => clearSession());
  await act(async () => {
    resolveResponse({ ok: true, json: async () => ({ data: staff }) });
  });
  expect(await screen.findByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Garage Staff' })).not.toBeInTheDocument();
});
