import { getApi, postApi, patchApi } from '../../../services/httpClient';

export const getOwnerDashboard = (options) => getApi('/owner/dashboard', options);
export const registerOwnerVehicle = (body) => postApi('/owner/vehicles', body);
export const resubmitVehicleDocuments = (id, body) => patchApi(`/owner/vehicles/${encodeURIComponent(id)}/documents`, body);
export const getOwnerAgreement = (id, options) => getApi(`/owner/agreements/${encodeURIComponent(id)}`, options);
export const signOwnerAgreement = (id, body) => postApi(`/owner/agreements/${encodeURIComponent(id)}/sign`, body);
export const requestOwnerPayout = (body) => postApi('/owner/payout-requests', body);
export const requestOwnerVehicleWithdrawal = (body) => postApi('/owner/vehicle-withdrawals', body);
export const reportOwnerIncident = (body) => postApi('/owner/incidents', body);
