import { getApi, patchApi, putApi } from '../../../services/httpClient';

const resourcePaths = {
  vehicles: '/vehicles?status=pending',
  incidents: '/incidents?status=open',
  policies: '/policies',
  staff: '/staff',
  finance: '/reports/finance',
  inspections: '/reports/inspections',
};

export function getManagerResource(resource, { from, to, signal } = {}) {
  const path = resourcePaths[resource];
  if (!path) throw new Error(`Unknown manager resource: ${resource}`);
  const query = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const separator = path.includes('?') ? '&' : '?';
  const queryString = query.toString();
  return getApi(`/manager${path}${queryString ? `${separator}${queryString}` : ''}`, { signal });
}

export const getManagerDashboard = (period, options) =>
  getApi(`/manager/dashboard?period=${encodeURIComponent(period)}`, options);
export const reviewVehicle = (id, body) => patchApi(`/manager/vehicles/${id}/review`, body);
export const reviewCompensation = (id, body) => patchApi(`/manager/incidents/${id}/compensation`, body);
export const reviewIncident = (id, body) => patchApi(`/manager/incidents/${id}/review`, body);
export const updatePolicy = (type, body) => putApi(`/manager/policies/${type}`, body);
export const updateStaff = (id, body) => patchApi(`/manager/staff/${id}`, body);
