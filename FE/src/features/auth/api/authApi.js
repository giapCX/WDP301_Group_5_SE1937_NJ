import { getApi, postApi } from '../../../services/httpClient';

export const login = (credentials) => postApi('/auth/login', credentials);
export const loginWithOtp = (credentials) => postApi('/auth/login/otp/verify', credentials);
export const getCurrentSessionUser = (options) => getApi('/auth/me', options);
