import { getApi } from '../../../api/client';

export const getHomepage = options => getApi('/homepage', options);
