import { getApi, getBlobApi, patchApi, postApi } from '../../../services/httpClient';

const paths = {
  vehicles: '/vehicles',
  bookings: '/bookings', listings: '/listings', incidents: '/incidents',
  violations: '/violations', disputes: '/disputes', complaints: '/complaints', overdue: '/overdue',
};

export function getOperationResource(resource, params = {}, options = {}) {
  const path = paths[resource];
  if (!path) throw new Error(`Unknown operation resource: ${resource}`);
  const query = new URLSearchParams(Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)]));
  return getApi(`/operation${path}${query.size ? `?${query}` : ''}`, options);
}

export const getOperationDashboard = (options) => getApi('/operation/dashboard', options);
export const getOperationStaff = (options) => getApi('/operation/staff', options);
export const getGarageStaff = (options) => getApi('/operation/garage-staff', options);
export const getVehicleDocument = (id, kind) => getBlobApi(`/operation/vehicles/${encodeURIComponent(id)}/documents/${encodeURIComponent(kind)}`);
export const screenVehicle = (id, body) => patchApi(`/operation/vehicles/${encodeURIComponent(id)}/screen`, body);
export const getOperationDetail = (resource, id, options) => getApi(`/operation${paths[resource]}/${encodeURIComponent(id)}`, options);
export const decideBooking = (id, body) => patchApi(`/operation/bookings/${encodeURIComponent(id)}/decision`, body);
export const updateListing = (id, body) => patchApi(`/operation/listings/${encodeURIComponent(id)}`, body);
export const reviewListing = (id, body) => patchApi(`/operation/listings/${encodeURIComponent(id)}/review`, body);
export const createIncident = (body) => postApi('/operation/incidents', body);
export const updateIncident = (id, body) => patchApi(`/operation/incidents/${encodeURIComponent(id)}`, body);
export const updateDispute = (id, body) => patchApi(`/operation/disputes/${encodeURIComponent(id)}`, body);
export const updateComplaint = (id, body) => patchApi(`/operation/complaints/${encodeURIComponent(id)}`, body);
export const reviewViolation = (id, body) => patchApi(`/operation/violations/${encodeURIComponent(id)}/review`, body);
export const overdueAction = (id, body) => postApi(`/operation/overdue/${encodeURIComponent(id)}/actions`, body);
