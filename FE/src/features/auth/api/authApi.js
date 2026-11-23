import api from '../../../api/client.js';

const options = { withCredentials: true };

export async function getSession(_params, signal) {
  const { data } = await api.get('/auth/me', { ...options, signal });
  return data.user;
}

export async function login(credentials) {
  const { data } = await api.post('/auth/login', credentials, options);
  return data.user;
}

export function logout() {
  return api.post('/auth/logout', {}, options);
}

export async function requestRegistrationOtp(profile) {
  const { data } = await api.post('/auth/register/otp', profile, options);
  return data.challengeId;
}

export async function registerWithOtp(verification) {
  const { data } = await api.post('/auth/register/verify', verification, options);
  return data.message;
}
