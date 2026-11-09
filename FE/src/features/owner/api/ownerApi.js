import { getApi, postApi } from '../../../services/httpClient';

export const getOwnerDashboard = (options) => getApi('/owner/dashboard', options);
export const registerOwnerVehicle = (body) => postApi('/owner/vehicles', body);
