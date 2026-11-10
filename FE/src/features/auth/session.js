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
