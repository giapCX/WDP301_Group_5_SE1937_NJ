import { getApi } from '../../../services/httpClient';

export const getListings = (params, options) => getApi('/listings?' + new URLSearchParams(params), options);
export const getListing = (id, options) => getApi('/listings/' + encodeURIComponent(id), options);
