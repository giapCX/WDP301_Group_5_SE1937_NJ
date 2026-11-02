import { getApi } from '../../../services/httpClient';

export const getHomepage = options => getApi('/homepage', options);
