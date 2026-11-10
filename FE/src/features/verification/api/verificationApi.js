import { getApi, postApi } from '../../../services/httpClient';

export const getMyVerification = (options) => getApi('/identity-verifications/me', options);
export const submitVerification = (body) => postApi('/identity-verifications', body);
