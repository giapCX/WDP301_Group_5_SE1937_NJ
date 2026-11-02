import { postApi } from '../../../services/httpClient';

export const login = credentials => postApi('/auth/login', credentials);
