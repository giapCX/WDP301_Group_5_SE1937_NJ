export function getSessionToken() {
  return localStorage.getItem('xedi_token') || sessionStorage.getItem('xedi_token');
}

export function canAccessGarage(user) {
  return user?.permissions?.some((permission) => [
    'vehicle.inspect', 'vehicle.intake', 'handover.record',
    'withdrawal.handover', 'garage.tasks.assign',
  ].includes(permission)) || false;
}

export function canAccessOwner(user) {
  return user?.roles?.some((role) => ['OWNER', 'CAR_OWNER'].includes(role)) || false;
}

export function getLoginDestination(user) {
  const paths = {
    ADMIN: '/#/admin',
    MANAGER: '/#/manager',
    OPERATION_STAFF: '/#/operator',
    GARAGE_STAFF: '/garage',
    OWNER: '/owner',
    CAR_OWNER: '/owner',
    DRIVER: '/#/driver',
    RENTER: '/#/renter',
  };
  if (Object.hasOwn(paths, user?.role?.code)) return paths[user.role.code];
  if (user?.roles?.includes('ADMIN')) return '/#/admin';
  if (user?.roles?.includes('MANAGER')) return '/#/manager';
  if (user?.roles?.includes('OPERATION_STAFF')) return '/#/operator';
  if (user?.roles?.includes('GARAGE_STAFF')) return '/garage';
  if (canAccessOwner(user)) return '/owner';
  if (canAccessGarage(user)) return '/garage';
  if (user?.roles?.includes('DRIVER')) return '/#/driver';
  if (user?.roles?.includes('RENTER')) return '/#/renter';
  return '/#trang-chu';
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('xedi_user') || sessionStorage.getItem('xedi_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem('xedi_token');
    storage.removeItem('xedi_user');
  }
  window.dispatchEvent(new Event('xedi:session'));
}

export function saveSession(token, user, rememberMe) {
  clearSession();
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('xedi_token', token);
  storage.setItem('xedi_user', JSON.stringify(user));
  window.dispatchEvent(new Event('xedi:session'));
}
