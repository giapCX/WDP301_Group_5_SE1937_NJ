import { canAccessGarage, clearSession, getCurrentUser, getLoginDestination, saveSession } from './session';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test('login routes garage permissions to garage and keeps manager and public destinations', () => {
  expect(getLoginDestination({ roles: ['GARAGE_STAFF'], permissions: ['vehicle.inspect'] })).toBe('/garage');
  expect(getLoginDestination({ roles: ['RENTER'], permissions: ['vehicle.intake'] })).toBe('/garage');
  expect(getLoginDestination({ roles: ['MANAGER'], permissions: ['vehicle.inspect'] })).toBe('/#/manager');
  expect(getLoginDestination({ roles: ['RENTER'], permissions: ['booking.create'] })).toBe('/#trang-chu');
  expect(canAccessGarage({ roles: ['GARAGE_STAFF'], permissions: [] })).toBe(false);
});

test('switching to a session login removes a previous remembered account', () => {
  saveSession('old-token', { full_name: 'Old account' }, true);
  saveSession('new-token', { full_name: 'New account' }, false);

  expect(localStorage.getItem('xedi_token')).toBeNull();
  expect(localStorage.getItem('xedi_user')).toBeNull();
  expect(sessionStorage.getItem('xedi_token')).toBe('new-token');
  expect(getCurrentUser().full_name).toBe('New account');
});

test('logout clears both storage locations and notifies the current page', () => {
  saveSession('token', { full_name: 'Renter' }, true);
  sessionStorage.setItem('xedi_token', 'stale-token');
  const onSession = jest.fn();
  window.addEventListener('xedi:session', onSession);
  try {
    clearSession();
    expect(localStorage.getItem('xedi_token')).toBeNull();
    expect(sessionStorage.getItem('xedi_token')).toBeNull();
    expect(getCurrentUser()).toBeNull();
    expect(onSession).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener('xedi:session', onSession);
  }
});

test('invalid stored user data does not break the header', () => {
  localStorage.setItem('xedi_user', '{invalid');
  expect(getCurrentUser()).toBeNull();
});
