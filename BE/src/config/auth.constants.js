function positiveInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

const AUTH_CONFIG = Object.freeze({
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME || 'viettour_session',
  LOGIN_ATTEMPT_WINDOW_MS: positiveInteger(process.env.LOGIN_ATTEMPT_WINDOW_MS, 900000, 'LOGIN_ATTEMPT_WINDOW_MS'),
  LOGIN_ATTEMPT_MAX: positiveInteger(process.env.LOGIN_ATTEMPT_MAX, 15, 'LOGIN_ATTEMPT_MAX'),
  SESSION_DURATION_MS: positiveInteger(process.env.SESSION_DURATION_MS, 43200000, 'SESSION_DURATION_MS'),
  REMEMBER_SESSION_DURATION_MS: positiveInteger(process.env.REMEMBER_SESSION_DURATION_MS, 2592000000, 'REMEMBER_SESSION_DURATION_MS'),
  OTP_LIFETIME_MS: positiveInteger(process.env.OTP_LIFETIME_MS, 600000, 'OTP_LIFETIME_MS'),
  OTP_RESEND_DELAY_MS: positiveInteger(process.env.OTP_RESEND_DELAY_MS, 60000, 'OTP_RESEND_DELAY_MS'),
  OTP_MAX_ATTEMPTS: positiveInteger(process.env.OTP_MAX_ATTEMPTS, 5, 'OTP_MAX_ATTEMPTS'),
});

const AUTH_COLLECTIONS = Object.freeze({ SESSIONS: 'auth_sessions', LOGIN_ATTEMPTS: 'auth_login_attempts', USERS: 'users' });

module.exports = { AUTH_COLLECTIONS, AUTH_CONFIG };
