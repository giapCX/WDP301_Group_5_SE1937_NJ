import { getApi, postApi } from '../../../services/httpClient';

export const login = (credentials, renterOnly) => postApi(renterOnly ? '/auth/renter/login' : '/auth/login', credentials);
export const loginWithOtp = (credentials, renterOnly) => postApi(
  renterOnly ? '/auth/renter/login/otp/verify' : '/auth/login/otp/verify', credentials,
);
export const getCurrentSessionUser = (options) => getApi('/auth/me', options);
